import * as docker from "./helpers"
import { DockerHost, Platform, get_default_host } from "."
import Path from "node:path"
import Fs from 'node:fs'
import { URI } from 'vscode-uri'
import { JSONSchema7 } from "json-schema"
import { docker_exec } from "./procs/exec"
import { docker_copy } from "./procs/copy"
export { URI }

export type DockerBinding<Path = string> = {
   host: Path
   container: Path
}

export type DockerBindings<Path = string> = {
   [name: string]: DockerBinding<Path>
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
   create_script(name: string): DockerScript {
      return new DockerScript(name, this)
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

type DockerTask = {
   proc: DockerProcedure
   data: any
   working_dir: string
}

export class DockerScript {
   private _tasks: DockerTask[] = []
   private _exposeds: { port: number, doc?: string }[] = []
   private _entry: { command: string[] | string, doc?: string } = null
   private _bindings: DockerBindings<string | boolean> = {}
   private _working_dir: string = null
   constructor(readonly name: string, readonly image: DockerImage) {
      this._working_dir = docker.system_dir[image.platform]
   }
   apply<T>(proc: DockerProcedure<T>, data?: T): DockerScript {
      this._tasks.push({ proc, data, working_dir: this._working_dir })
      return this
   }
   execute(...args: string[]) {
      return this.apply(docker_exec, { args })
   }
   cwd(path: string): DockerScript {
      this._working_dir = path
      return this
   }
   checkpoint() {
      return this
   }
   copy(dest: string, url: string): DockerScript {
      return this.apply(docker_copy, { dest, url })
   }
   mount(endpoint: string, binding: DockerBinding<string | boolean>): DockerScript {
      this._bindings[endpoint] = binding
      return this
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
      const target = await this.image.create_container(this.name, this._bindings)

      const env = new DockerEnvironment(target)
      for (const task of this._tasks) {
         const { proc, data, working_dir } = task
         env.working_dir = working_dir
         await proc.apply(target, env, data)
      }
      this._tasks = null

      const image_id = await docker.commit_container_image(target, {
         name: this.name,
         version,
         command: this._entry?.command,
         working_dir: target.path(this._working_dir),
         ports: this._exposeds.map(x => x.port),
      })

      return new DockerImage(image_id, target.platform)
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
      if (!working_dir) working_dir = this.system_dir
      else working_dir = this.path(working_dir)
      return docker.execute_container_command(this.host, this.id, working_dir, args)
   }
}

export interface DockerProcedure<T extends any = unknown> {
   schema(): JSONSchema7
   apply(target: DockerContainer, env: DockerEnvironment, config?: T)
}

export default {
   open_image(name: string, platform: Platform): DockerImage {
      return new DockerImage(name, platform)
   },
}
