import * as docker from "./helpers"
import { DockerHost, Platform, get_default_host } from "."
import Path from "node:path"
import Fs from 'node:fs'
import { URI } from 'vscode-uri'
import { JSONSchema7 } from "json-schema"
export { URI }

export type DockerBindings<Path = string> = {
   [name: string]: {
      host: Path
      container: Path
   }
}

export class DockerImage {
   constructor(
      readonly name: string,
      readonly platform: Platform,
   ) {
   }
   async open_container(name: string, bindings: DockerBindings<string | boolean>): Promise<DockerContainer> {
      const host = get_default_host()
      const nbindings = normalize_docker_bindings(this, bindings)
      await docker.open_container(host, name, create_docker_container_config(this, nbindings))
      return new DockerContainer(name, host, this, nbindings)
   }
   async create_container(name: string, bindings: DockerBindings<string | boolean>): Promise<DockerContainer> {
      const host = get_default_host()
      const nbindings = normalize_docker_bindings(this, bindings)
      await docker.reset_container(host, name, create_docker_container_config(this, nbindings))
      return new DockerContainer(name, host, this, nbindings)
   }
}

function normalize_posix_path(path: string) {
   path = path.replaceAll("\\", "/")
   if (path[1] === ":") {
      path = `//${path[0]}${path.slice(2)}`
   }
   return path
}

function normalize_docker_bindings(image: DockerImage, bindings: DockerBindings<string | boolean>): DockerBindings<string> {
   function normalize_path(path: boolean | string, defaultBase: string, platform: Platform): string {
      if (path === true) return Path.resolve(defaultBase)
      else if (typeof path === "string") return Path.resolve(path)
      else return null
   }

   bindings = {
      ...bindings,
      "cache": { host: true, container: true, }
   }

   const nbindings = {}
   for (const name in bindings) {
      let { host, container } = bindings[name]
      nbindings[name] = {
         host: normalize_path(host, `./.shared/${name}`, Platform.win_x64),
         container: normalize_path(container, `c:/mnt/${name}`, image.platform),
      }
      if (host === true) Fs.mkdirSync(nbindings[name].host, { recursive: true })
   }
   return nbindings
}

function create_docker_container_config(image: DockerImage, bindings: DockerBindings<string>) {

   const Binds = []
   for (const name in bindings) {
      const bind = bindings[name]
      if (bind.host && bind.container) {
         Binds.push(`${bind.host}:${bind.container}`)
      }
   }

   return {
      Image: image.name,
      Entrypoint: docker.wait_entrypoint[image.platform],
      HostConfig: {
         Binds,
      }
   }
}

export class DockerEnvironment {
   working_dir: string = undefined
   constructor(
      readonly target: DockerContainer,
   ) {
   }
}

export class DockerScript extends DockerEnvironment {
   private _execution: (() => void)[] = []
   private _exposeds: { port: number, doc?: string }[] = []
   private _entry: { command: string[] | string, doc?: string } = null
   schedule(method: () => Promise<void>): DockerScript {
      this._execution.push(method)
      return this
   }
   apply<T>(cmd: DockerCommand<T>, config?: T): DockerScript {
      return this.schedule(() => {
         return cmd.apply(this.target, this, config)
      })
   }
   execute(program: string, args: string[] = []) {
      return this.schedule(() => {
         return docker.execute_container_command(this.target.host, this.target.id, this.working_dir, [program, ...args])
      })
   }
   cwd(path: string): DockerScript {
      this.working_dir = this.target.path(path)
      return this
   }
   checkpoint() {
      return this
   }
   copy(dest: string, url: string): DockerScript {
      return this.schedule(async () => {
         if (url.startsWith("https:")) {
            url = await docker.fetch_remote_file(this.target, url)
         }
         return docker.copy_host_file(this.target, dest, url)
      })
   }
   expose(port: number, doc?: string): DockerScript {
      this._exposeds.push({ port, doc })
      return this
   }
   entry(command: string[] | string, doc?: string): DockerScript {
      this._entry = { command, doc }
      return this
   }
   async commit(version?: string, name?: string): Promise<DockerImage> {
      for (const exec of this._execution) {
         await exec()
      }
      this._execution = null

      const image_id = await docker.commit_container_image(this.target, {
         name,
         version,
         command: this._entry?.command,
         working_dir: this.working_dir,
         ports: this._exposeds.map(x => x.port),
      })

      return new DockerImage(image_id, this.target.platform)
   }
}

export class DockerContainer {
   platform: Platform
   attributes: { [key: string | symbol]: any } = {}
   system_dir: string
   constructor(
      readonly id: string,
      readonly host: DockerHost,
      readonly image: DockerImage,
      readonly bindings: DockerBindings,
   ) {
      this.platform = image.platform
      this.system_dir = docker.system_dir[image.platform]
   }
   host_path(ref: string | URI): string {
      if (typeof ref === "string") ref = URI.parse(ref)
      const binding = this.bindings[ref.scheme]
      if (binding?.host) {
         return Path.join(binding.host, ref.path)
      }
      else {
         return null
      }
   }
   path(ref: string | URI): string {
      if (typeof ref === "string") ref = URI.parse(ref)
      const binding = this.bindings[ref.scheme]
      if (binding?.container) {
         return Path.join(binding.container, ref.path)
      }
      else {
         return Path.join(this.system_dir, ref.path)
      }
   }
   fetch(url: string): Promise<string> {
      return docker.fetch_remote_file(this, url)
   }
   execute(args: string[] = [], working_dir?: string): Promise<void> {
      return docker.execute_container_command(this.host, this.id, working_dir || this.system_dir, args)
   }
   script(): DockerScript {
      return new DockerScript(this)
   }
}

export interface DockerCommand<T extends any = unknown> {
   schema(): JSONSchema7
   apply(target: DockerContainer, env: DockerEnvironment, config?: T)
}

export default {
   open_image(name: string, platform: Platform): DockerImage {
      return new DockerImage(name, platform)
   },
}
