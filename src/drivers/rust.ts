import { DockerCommand, DockerContainer, DockerEnvironment } from "../docker/builder"

const RustInstall = Symbol("rust-install")

export const use_rust: DockerCommand<string> = {
   async apply(target: DockerContainer, env: DockerEnvironment, semver: string): Promise<void> {
      if (!target.attributes[RustInstall]) {
         target.attributes[RustInstall] = semver || "*"
      }
   }
}

export const cargo: DockerCommand<string[]> = {
   async apply(target: DockerContainer, env: DockerEnvironment, args: string[]): Promise<void> {
      await use_rust.apply(target, env)
      await target.execute(["cargo", ...args], env.working_dir)
   }
}
