import { DockerProcedure, DockerContainer, DockerEnvironment } from "../builder"
import { JSONSchema7 } from "json-schema"
import * as docker from "../helpers"

export type Options = {
   dest: string,
   url: string,
}

export const docker_copy: DockerProcedure<Options> = {
   schema(): JSONSchema7 {
      return {}
   },
   async apply(target: DockerContainer, env: DockerEnvironment, opts: Options): Promise<void> {
      let { url, dest } = opts
      if (url.startsWith("https:")) {
         url = await docker.fetch_remote_file(target, url)
      }
      return docker.copy_host_file(target, dest, url)
   }
}
