import { DockerCommand, DockerContainer, DockerEnvironment } from "../docker/builder"
import { JSONSchema7 } from "json-schema"

const RustInstall = Symbol("rust-install")

export const use_rust: DockerCommand<string> = {
   schema(): JSONSchema7 {
      return { type: "string" }
   },
   async apply(target: DockerContainer, env: DockerEnvironment, semver: string): Promise<void> {
      if (!target.attributes[RustInstall]) {
         target.attributes[RustInstall] = semver || "*"
      }
   },
}

export const cargo: DockerCommand<string[]> = {
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
