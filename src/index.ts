import { npm } from "./drivers/nodejs"
import dockable from "./docker/builder"
import { Platform } from "./docker"
import { commit_container_image } from "./docker/helpers"

const server_core = dockable.open_image("mcr.microsoft.com/windows/servercore:ltsc2019", Platform.win_x64)
const nano_core = dockable.open_image("mcr.microsoft.com/windows/nanoserver:ltsc2019", Platform.win_x64)

const builder = await nano_core.create_container("builder", {
   "data": {
      host: "./exemples/node-app",
      container: true,
   },
   "app": {
      host: false,
      container: "/app"
   }
})

const builder_image = await builder.script()
   .execute("cmd.exe", ["/c", "echo hello world: toto"])
   .copy("app:index.mjs", "data:index.mjs")
   .copy("app:package.json", "data:package.json")
   //.copy("app:*", "data:*")
   .cwd("app:")
   .apply(npm, ["install"])
   .entry(["node.exe", "index.mjs"])
   .expose(3000)
   .commit("build")

/*
const app = await nano_core.create_container("app")
await app.apply(use_nodejs)
   .apply(use_rust)
   .copy("/app", dockable.path("/app"))
   .complete()
*/

console.log("builder_image", builder_image)
console.log("------------ end ------------")
