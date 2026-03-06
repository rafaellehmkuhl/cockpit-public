#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-undef */

const fs = require('fs')
const path = require('path')

const mdiModule = require('@mdi/js')

const names = Object.keys(mdiModule)
  .filter((key) => key.startsWith('mdi'))
  .map((key) => key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()))
  .sort()

const output = `/**
 * Auto-generated list of all MDI icon names.
 * Do not edit manually. Run \`yarn generate:mdi-names\` to regenerate.
 */
export const mdiIconNames: string[] = ${JSON.stringify(names, null, 2)}
`

const outputPath = path.resolve(__dirname, '..', 'src', 'assets', 'mdi-icon-names.ts')
fs.writeFileSync(outputPath, output, 'utf-8')

console.log(`Generated ${names.length} icon names at ${outputPath}`)
