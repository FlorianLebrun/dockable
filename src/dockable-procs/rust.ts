import { DockerProcedure, DockerContainer, DockerEnvironment } from "../dockable-cli/builder"
import { JSONSchema7 } from "json-schema"

const RustInstall = Symbol("rust-install")

export const use_rust: DockerProcedure<string> = {
   schema(): JSONSchema7 {
      return { type: "string" }
   },
   async apply(target: DockerContainer, env: DockerEnvironment, semver: string): Promise<void> {
      if (!target.attributes[RustInstall]) {
         target.attributes[RustInstall] = semver || "*"
      }
   },
}

export const cargo: DockerProcedure<string[]> = {
   schema(): JSONSchema7 {
      return {
         type: "array",
         items: { type: "string" }
      }
   },
   async apply(target: DockerContainer, env: DockerEnvironment, args: string[]): Promise<void> {
      await use_rust.apply(target, env)
      await target.execute(["cargo", ...args], env.working_dir)
   },
}
