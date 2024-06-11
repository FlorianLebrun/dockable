import { npm } from "./dockable-procs/nodejs"
import dockable from "./dockable-cli/builder"
import { Platform } from "./dockable-cli"
import { use_7zip } from "./dockable-procs/7zip"

const server_core = dockable.open_image("mcr.microsoft.com/windows/servercore:ltsc2019", Platform.win_x64)
const nano_core = dockable.open_image("mcr.microsoft.com/windows/nanoserver:ltsc2019", Platform.win_x64)

const builder0_image = await nano_core.create_script("builder-image")
   .apply(use_7zip)
   .execute("7zr")
   .commit()

if (0) {
   const builder_image = await nano_core.create_script("builder-image")
      .mount("data", { host: "./exemples/node-app", container: true })
      .mount("app", { host: false, container: "/app" })
      .execute("cmd.exe", "/c", "echo hello world: toto")
      .copy("app:index.mjs", "data:index.mjs")
      .copy("app:package.json", "data:package.json")
      //.copy("app:*", "data:*")
      .cwd("app:")
      .apply(npm, ["install"])
      .entry(["node.exe", "index.mjs"])
      .expose(3000)
      .commit("build")

   console.log("builder_image", builder_image)

   const app = await builder_image.create_container("app")
}

console.log("------------ end ------------")
