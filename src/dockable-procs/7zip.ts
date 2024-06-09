import { JsonSchema } from "json-schema-library"
import { DockerProcedure, DockerContainer, DockerEnvironment } from "../dockable-cli/builder"

const ZipInstall = Symbol("7zip-install")

export const use_7zip: DockerProcedure = {
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