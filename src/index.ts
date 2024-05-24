import { npm, use_nodejs } from "./drivers/nodejs"
import dockable from "./builder"
import { cargo, use_rust } from "./drivers/rust"
import { Platform } from "./docker"

const server_core = dockable.open_image("mcr.microsoft.com/windows/servercore:ltsc2019", Platform.win_x64)
const nano_core = dockable.open_image("mcr.microsoft.com/windows/nanoserver:ltsc2019", Platform.win_x64)

const builder = await nano_core.open_container("builder")
await builder.cwd("app")
   .execute("cmd.exe", ["/c", "echo hello world"])
   /*.apply(npm, ["ci"])
   .apply(cargo, ["build", "mytarget"])
   .copy("download", dockable.path("download"))*/
   .complete()
/*
const app = await nano_core.create_container("app")
await app.apply(use_nodejs)
   .apply(use_rust)
   .copy("/app", dockable.path("/app"))
   .complete()

*/

console.log("------------ end ------------")
