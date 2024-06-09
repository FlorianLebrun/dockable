import { JsonSchema } from "json-schema-library"
import { DockerCommand, DockerContainer, DockerEnvironment } from "../docker/builder"

const ZipInstall = Symbol("7zip-install")

export const use_7zip: DockerCommand = {
   schema(): JsonSchema {
      return null
   },
   async apply(target: DockerContainer, env: DockerEnvironment): Promise<void> {
      if (!target.attributes[ZipInstall]) {
         target.attributes[ZipInstall] = "*"
         await target.execute(["install", "7zip"])
      }
   }
}