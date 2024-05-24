import { DockerCommandDriver, DockerContainer } from "../builder"
import { Platform } from "../docker"
import { use_7zip } from "./7zip"
import { agent } from "./common"
import Path from 'node:path'
import Fs from 'node:fs'

const NodeJsInstall = Symbol("nodejs-install")

async function downloadNodeVersion(version: string, platform: Platform, destination: string) {

   let pkgname: string
   if (platform === Platform.win_x64) pkgname = `node-${version}-x64.msi`
   else pkgname = `node-${version}-linux-x64.tar.xz`

   const url = `https://nodejs.org/dist/${version}/${pkgname}`
   const filePath = Path.join(destination, pkgname)
   try {
      if (!Fs.existsSync(filePath)) {
         const response = await agent.request({
            url,
            method: 'GET',
            responseType: 'stream',
         })
         Fs.mkdirSync(destination, { recursive: true })
         const writer = Fs.createWriteStream(filePath)
         response.data.pipe(writer)
         return new Promise((resolve, reject) => {
            writer.on('finish', resolve)
            writer.on('error', reject)
         })
      }
   } catch (error) {
      console.error(`Error downloading Node.js version ${version}:`, error)
      throw error
   }
   return null
}

export const use_nodejs: DockerCommandDriver<string> = {
   async apply(target: DockerContainer, semver: string): Promise<void> {
      await use_7zip.apply(target)

      let dist = target.attributes[NodeJsInstall]
      if (!dist) {
         const catalog = await agent.get('https://nodejs.org/dist/index.json');
         dist = catalog.data[0]
         target.attributes[NodeJsInstall] = dist

         await downloadNodeVersion(dist.version, target.platform, "./download")

         const { version } = dist
         const url = `https://nodejs.org/dist/${version}/node-${version}-${target.platform}.tar.xz`; // Change the URL based on your OS and architecture
         const filePath = Path.join("download", `node-${version}-${target.platform}.tar.xz`);
         target.execute("unzip", [filePath])
      }
      else {
         //TODO: check dist with semver
      }
   }
}

export const npm: DockerCommandDriver<string[]> = {
   async apply(target: DockerContainer, args: string[]): Promise<void> {
      await use_nodejs.apply(target)
      target.execute("npm", args)
   }
}
