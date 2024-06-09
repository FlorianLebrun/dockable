import { DockerProcedure, DockerContainer, DockerEnvironment } from "../builder"
import { JSONSchema7 } from "json-schema"

export type Options = {
   args: string[],
}

export const docker_exec: DockerProcedure<Options> = {
   schema(): JSONSchema7 {
      return {}
   },
   async apply(target: DockerContainer, env: DockerEnvironment, opts: Options): Promise<void> {
      return target.execute(opts.args, env.working_dir)
   }
}
