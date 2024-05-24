import * as docker from "../docker/helpers"
import { DockerHost, Platform, get_default_host } from "../docker"

export class DockerPath {
   path: string
   source?: DockerContainer
}

export class DockerImage {
   constructor(
      readonly name: string,
      readonly platform: Platform,
   ) {
   }
   async open_container(name: string): Promise<DockerContainer> {
      const host = get_default_host()
      await docker.open_container(host, name, this.name)
      return new DockerContainer(name, host, this)
   }
   async create_container(name: string): Promise<DockerContainer> {
      const host = get_default_host()
      await docker.reset_container(host, name, {
         Image: this.name,
         Entrypoint: docker.wait_entrypoint[this.platform],
      })
      return new DockerContainer(name, host, this)
   }
}

export class DockerContainer {
   platform: Platform
   attributes: { [key: string | symbol]: any } = {}
   execution: Promise<void> = Promise.resolve()
   constructor(
      readonly name: string,
      readonly host: DockerHost,
      readonly image: DockerImage,
   ) {
      this.platform = image.platform
   }
   apply<T>(driver: DockerCommandDriver<T>, config?: T): DockerContainer {
      this.execution = this.execution.then(() => {
         return driver.apply(this, config)
      })
      return this
   }
   execute(program: string, args: string[]) {
      this.execution = this.execution.then(() => {
         return docker.execute_container_command(this.host, this.name, [program, ...args])
      })
      return this
   }
   cwd(path: string): DockerContainer {
      return this
   }
   checkpoint() {
      return this
   }
   copy(dest: string, src: DockerPath): DockerContainer {
      return this
   }
   expose(port: number, doc?: string): DockerContainer {
      return this
   }
   entry(port: number, doc?: string): DockerContainer {
      return this
   }
   async complete() {
      await this.execution
      return this
   }
}

export interface DockerCommandDriver<T extends any = unknown> {
   apply(target: DockerContainer, config?: T)
}

export default {
   open_image(name: string, platform: Platform): DockerImage {
      return new DockerImage(name, platform)
   },
   path(path: string): DockerPath {
      return null
   },
}
