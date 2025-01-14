import { IncomingMessage } from "node:http"
import { DockerHost, Platform } from "."
import Path from 'node:path'
import Fs from 'node:fs'
import { ContainerCreateRequest, ExecInspectResponse } from "./api"
import { DockerContainer } from "./builder"
import axios from 'axios'
import Https from 'node:https'
import { createHash } from "node:crypto"
import Colors from "colors"

export const agent = axios.create({
   httpsAgent: new Https.Agent({
      rejectUnauthorized: false
   })
})

export const system_dir = {
   [Platform.linux_x64]: "/",
   [Platform.win_x64]: "c:/",
}

export const wait_entrypoint = {
   [Platform.linux_x64]: ["tail", "-f", "/dev/null"],
   [Platform.win_x64]: ["cmd.exe", "/c", "ping -t localhost"],
}

export const shell_prefix = {
   [Platform.linux_x64]: ["/bin/sh", "-c"],
   [Platform.win_x64]: ["cmd.exe", "/c"],
}

export const shell_command = {
   [Platform.linux_x64]: ["/bin/sh"],
   [Platform.win_x64]: ["cmd.exe"],
}

export function remake_error(text: string, origin: any) {
   let reason: string = null
   if (typeof origin?.response?.data === "string") reason = origin.response.data
   else if (typeof origin?.response?.data?.message === "string") reason = origin.response.data.message
   else if (typeof origin?.message === "string") reason = origin.message
   return new Error(reason ? `${text} : ${reason}` : text)
}

export async function open_container(host: DockerHost, containerId: string, config: ContainerCreateRequest) {
   const list = await host.ContainerApi.containerList(true)
   for (const item of list) {
      if (item.Names.includes("/" + containerId)) {
         if (item.State !== "running") {
            await host.ContainerApi.containerStart(containerId)
         }
         return
      }
   }
   return reset_container(host, containerId, config)
}

export async function reset_container(host: DockerHost, containerId: string, config: any) {
   try {
      await remove_container(host, containerId)
      await host.ContainerApi.containerCreate(config, containerId)
      await host.ContainerApi.containerStart(containerId)
   } catch (err) {
      throw remake_error(`Fail reset container ${containerId}`, err)
   }
}

export async function remove_container(host: DockerHost, containerId: string): Promise<boolean> {
   try {
      await host.ContainerApi.containerStop(containerId)
   } catch (err) { }
   try {
      await host.ContainerApi.containerDelete(containerId)
      return true
   } catch (err) {
      return false
   }
}

export async function execute_container_command(host: DockerHost, containerId: string, workingDir: string, command: string[]) {
   let exec_state: ExecInspectResponse = null
   console.log(Colors.yellow("> CMD: " + Colors.italic(command.join(" "))))
   try {
      const exec_res = await host.ExecApi.containerExec(containerId, {
         Cmd: command,
         User: "Administrator",
         WorkingDir: workingDir,
         AttachStdout: true,
         AttachStderr: true,
      }, containerId)

      const exec_log = await host.ExecApi.execStart(exec_res.Id, {
         Detach: false,
         Tty: false,
      }, {
         responseType: 'stream'
      }) as IncomingMessage

      let last_line = ""
      exec_log.on('data', (data: Buffer) => {
         let lines = (last_line + data.toString("utf8").slice(8)).split("\n")
         last_line = lines.pop()
         lines.forEach(line => console.log(Colors.blue("\u2502 " + line)))
      })

      let delay: number = 1
      while (1) {
         exec_state = await host.ExecApi.execInspect(exec_res.Id)
         if (exec_state.Running === false) break
         exec_state.ExitCode
         await new Promise(resolve => setTimeout(resolve, delay))
         delay = Math.min(1000, delay * 2)
      }
      exec_log.destroy()
   } catch (err) {
      throw remake_error(`Fail command`, err)
   }
   if (exec_state?.ExitCode) {
      throw new Error(`Exit with ${exec_state.ExitCode}`)
   }
}

export async function copy_host_file(target: DockerContainer, dest: string, path: string) {
   const host_path = target.host_path(path)
   if (!host_path || Fs.existsSync(host_path)) {
      try {
         const cnt_path = target.path(path)
         const cnt_dest = target.path(dest)
         await target.execute([
            "cmd.exe", "/c",
            "md", Path.dirname(cnt_dest), "&",
            "copy", cnt_path, cnt_dest,
         ])
      } catch (error) {
         throw new Error(`Fail copy file '${path}' -> '${dest}'`)
      }
   }
   else throw new Error(`File not exists on host at '${host_path}'`)
}

export async function fetch_remote_file(target: DockerContainer, url: string, extension?: string): Promise<string> {
   const id = createHash('sha256').update(url, 'utf8').digest().toString("base64url")
   const path = `cache:/${id}${extension || Path.extname(url)}`
   console.log(Colors.yellow("> FETCH: " + Colors.italic(url) + " -> " + Colors.bold(path)))
   try {
      const host_path = target.host_path(path)
      if (!Fs.existsSync(host_path)) {
         const response = await agent.request({
            url,
            method: 'GET',
            responseType: 'stream',
         })

         const writer = Fs.createWriteStream(host_path)
         response.data.pipe(writer)

         await new Promise((resolve, reject) => {
            writer.on('finish', resolve)
            writer.on('error', reject)
         })
      }
      return path
   } catch (error) {
      throw new Error(`Fail downloading file '${url}' -> '${path}': ${error.message}`)
   }
}

export async function commit_container_image(target: DockerContainer, config: {
   name?: string
   version?: string
   command: string[] | string
   working_dir: string
   ports?: number[]
   env?: { [varname: string]: string | number }
}) {
   const image_name = config.name || target.id
   const image_tag = config.version || "latest"
   const image_ref = `${image_name}:${image_tag}`
   console.log(Colors.yellow("> COMMIT: " + Colors.italic(image_ref)))

   const env = Object.keys(config.env || {}).reduce((env, varname) => {
      env.push(`${varname}=${config.env[varname]}`)
      return env
   }, [])

   const exposed_ports = (config.ports || []).reduce((exposeds, port) => {
      exposeds[`${port}/tcp`] = {}
      return exposeds
   }, {})

   let entrypoint: string[] = null, cmd: string[] = null, shell: string[] = null
   if (Array.isArray(config.command)) {
      entrypoint = config.command
      cmd = config.command
      shell = shell_prefix[target.platform]
   }
   else {
      cmd = [config.command]
      shell = shell_prefix[target.platform]
   }
   try {
      await target.host.ContainerApi.containerStop(target.id)
      const result = await target.host.ImageApi.imageCommit(target.id, image_name, image_tag, undefined, undefined, undefined, undefined, {
         "AttachStdin": false,
         "AttachStdout": true,
         "AttachStderr": true,
         "ExposedPorts": exposed_ports,
         "Tty": false,
         "OpenStdin": false,
         "StdinOnce": false,
         "Env": env,
         "Entrypoint": entrypoint,
         "Cmd": cmd,
         "Shell": shell,
         "Healthcheck": {
            "Test": [],
            "Interval": 0,
            "Timeout": 0,
            "Retries": 0,
            "StartPeriod": 0,
            "StartInterval": 0
         },
         "ArgsEscaped": false,
         "Image": image_ref,
         "Volumes": null,
         "WorkingDir": config.working_dir,
         "NetworkDisabled": false,
         "OnBuild": [],
         "Labels": null,
         "StopSignal": "SIGTERM",
         "StopTimeout": 10,
      })
      await target.host.ContainerApi.containerStart(target.id)
      console.log(Colors.blue(`\u2502 Image '${image_ref}' created`))
      console.log(Colors.blue(`\u2502 Image raw id: ${result.Id}`))
      return image_ref
   }
   catch (err) {
      throw remake_error("Fail container commit", err)
   }
}

