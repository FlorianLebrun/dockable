#!/usr/bin/env node
const { script, print, command } = require('@ewam/script.cli')

script(() => {

   // Transpile ts source code
   try {
      print.info(`> Transpile typescript source code`)
      command.exec(`ttsc`)
   }
   catch (e) {
      print.error(`> ts source code contains issues to fix`)
   }
})
