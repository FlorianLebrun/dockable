import { DockerCommand, DockerContainer, DockerEnvironment } from "../docker/builder"
import { Platform } from "../docker"
import * as docker from "src/docker/helpers"
import { JSONSchema7 } from "json-schema"

const NodeJsInstall = Symbol("nodejs-install")

export const use_nodejs: DockerCommand<string> = {
   schema(): JSONSchema7 {
      return { type: "string" }
   },
   async apply(target: DockerContainer, env: DockerEnvironment, semver: string): Promise<void> {
      let dist = target.attributes[NodeJsInstall]
      if (!dist) {
         const catalog = await docker.agent.get('https://nodejs.org/dist/index.json');
         dist = catalog.data[0]
         target.attributes[NodeJsInstall] = dist
         await install_node_version(target, dist.version, target.platform, "/download")
      }
      else {
         //TODO: check dist with semver
      }
   }
}

async function install_node_version(target: DockerContainer, version: string, platform: Platform, destination: string) {
   if (platform === Platform.win_x64) {
      const pkg_url = `https://nodejs.org/dist/${version}/node-${version}-win-x64.zip`
      const pkg_file = await target.fetch(pkg_url)
      await target.execute([
         "cmd.exe", "/c",
         "md", target.path("Programs/node"), "&",
         "tar", "-xf", target.path(pkg_file), "-C", target.path("Programs/node"), "--strip-components=1", "&",
         "setx", "/M", "PATH", `${target.path("Programs/node")};%PATH%`,
      ])
   }
   else {
      const pkgname = `node-${version}-linux-x64.tar.xz`
      throw new Error("TODO")
   }
}

export const npm: DockerCommand<string[]> = {
   schema(): JSONSchema7 {
      return {
         type: "array",
         items: { type: "string" }
      }
   },
   async apply(target: DockerContainer, env: DockerEnvironment, args: string[]): Promise<void> {
      await use_nodejs.apply(target, env)
      await target.execute(["cmd.exe", "/c", "npm", ...args], env.working_dir)
   }
}
