#!/usr/bin/env node
if (process.argv.includes("--enable-devmode")) {
   const argv = process.argv.slice(2).filter(arg => arg !== "--enable-devmode")
   process.argv = [process.argv[0], process.argv[1], "devrun", "--watch", "./dist", "--program", "./dist/cli.js", "--", ...argv]
   await import("./devrun.cjs")
}
else {
   await import("../dist/cli.js")
}
