import { JsonSchema } from "json-schema-library"
import { DockerProcedure, DockerContainer, DockerEnvironment } from "../dockable-cli/builder"

const ZipInstall = Symbol("7zip-install")

const defaultVersion = "24.06"

export const use_7zip: DockerProcedure<string> = {
   schema(): JsonSchema {
      return null
   },
   async apply(target: DockerContainer, env: DockerEnvironment, version: string): Promise<void> {
      version = version || defaultVersion
      if (!target.attributes[ZipInstall]) {
         const digits = version.split(".")
         const pkg_file = await target.fetch(`https://7-zip.org/a/7zr.exe`)
         //const pkg2_file = await target.fetch(`https://7-zip.org/a/7z${digits[0]}${digits[1]}-extra.7z`)
         target.attributes[ZipInstall] = version

         await target.execute([
            "cmd.exe", "/c",
            "md", target.path("Programs/7zip"), "&",
            "copy", "/b", target.path(pkg_file), target.path("Programs/7zip"), "&",
            "setx", "/M", "PATH", `${target.path("Programs/7zip")};%PATH%`,
         ])
      }
   }
}
