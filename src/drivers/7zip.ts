import { DockerCommandDriver, DockerContainer } from "../builder"

const ZipInstall = Symbol("7zip-install")

export const use_7zip: DockerCommandDriver = {
   async apply(target: DockerContainer): Promise<void> {
      if (!target.attributes[ZipInstall]) {
         target.attributes[ZipInstall] = "*"
         target.execute("install", ["7zip"])
      }
   }
}