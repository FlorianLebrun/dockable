import { IncomingMessage } from "http"
import { DockerHost, Platform } from "."


export const wait_entrypoint = {
   [Platform.linux_x64]: ["tail", "-f", "/dev/null"],
   [Platform.win_x64]: ["cmd.exe", "/c", "ping -t localhost"],
}

export async function open_container(host: DockerHost, name: string, config: any) {
   const list = await host.ContainerApi.containerList(true)
   for (const item of list) {
      if (item.Names.includes("/" + name)) {
         if (item.State !== "running") {
            await host.ContainerApi.containerStart(name)
         }
         return
      }
   }
   await host.ContainerApi.containerCreate(config, name)
   await host.ContainerApi.containerStart(name)
}

export async function reset_container(host: DockerHost, containerId: string, config: any) {
   await remove_container(host, containerId)
   await host.ContainerApi.containerCreate(config, containerId)
   await host.ContainerApi.containerStart(containerId)
}

export async function remove_container(host: DockerHost, containerId: string): Promise<boolean> {
   try {
      await host.ContainerApi.containerStop(containerId)
   } catch (e) { }
   try {
      await host.ContainerApi.containerDelete(containerId)
      return true
   } catch (e) {
      return false
   }
}

export async function execute_container_command(host: DockerHost, containerId: string, command: string[]) {
   try {
      console.log("> CMD:", command.join(" "))

      const exec_res = await host.ExecApi.containerExec(containerId, {
         Cmd: command,
         AttachStdout: true,
         AttachStderr: true,
      }, containerId)

      const exec_log = await host.ExecApi.execStart(exec_res.Id, {
         Detach: false,
         Tty: false,
      }, {
         responseType: 'stream'
      }) as IncomingMessage

      exec_log.on('data', (chunk: Buffer) => {
         console.log(">", chunk.slice(8).toString())
      })

      let delay: number = 1
      while (1) {
         const exec_state = await host.ExecApi.execInspect(exec_res.Id)
         if (exec_state.Running === false) {
            exec_log.destroy()
            break
         }
         await new Promise(resolve => setTimeout(resolve, delay))
         delay = Math.min(1000, delay * 2)
      }
   } catch (error) {
      console.error('Error executing command in container:', error.response ? error.response.data : error.message)
   }
}
