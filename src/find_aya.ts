import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import { toolName, cliFileName, versionNightly } from './constants.js'
import path from 'path'
import fs from 'fs'

export class Aya {
  cliJar: string

  constructor(cliJar: string) {
    this.cliJar = cliJar
  }

  exec(...args: string[]): Promise<number> {
    return exec.exec('java', ['-jar', this.cliJar, ...args])
  }

  execOutput(...args: string[]): Promise<exec.ExecOutput> {
    return exec.getExecOutput('java', ['-jar', this.cliJar, ...args])
  }
}

export function findAya(): Aya {
  const ayaHome = tc.find(toolName, versionNightly)
  const ayaJar = path.join(ayaHome, cliFileName)
  if (!fs.existsSync(ayaJar)) {
    throw new Error('Aya not found: ' + ayaJar)
  }

  return new Aya(ayaJar)
}
