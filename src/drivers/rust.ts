import { DockerCommandDriver, DockerContainer } from "../builder"

const RustInstall = Symbol("rust-install")

export const use_rust: DockerCommandDriver<string> = {
   async apply(target: DockerContainer, semver: string): Promise<void> {
      if (!target.attributes[RustInstall]) {
         target.attributes[RustInstall] = semver || "*"
      }
   }
}

export const cargo: DockerCommandDriver<string[]> = {
   async apply(target: DockerContainer, args: string[]): Promise<void> {
      await use_rust.apply(target)
      target.execute("cargo", args)
   }
}
