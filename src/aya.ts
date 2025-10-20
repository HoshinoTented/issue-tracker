import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import { ayaToolName, cliFileName } from './constants.js'
import path from 'path'
import fs from 'fs'
import { RichExecOutput } from './types.js'

export type IssueSetupOutput = {
  version: {
    major: number, minor: number, patch: number,
    snapshot: boolean, hash: string | null, java: number
  },
  files: string[]
}

export class Aya {
  cliJar: string

  constructor(cliJar: string) {
    this.cliJar = cliJar
  }

  exec(...args: string[]): Promise<number> {
    return exec.exec('java', ['-jar', this.cliJar, ...args])
  }

  async execOutput(...args: string[]): Promise<RichExecOutput> {
    let stdall: string = ''

    const execOutput = await exec.getExecOutput(
      'java',
      ['-jar', this.cliJar, ...args],
      {
        ignoreReturnCode: true,
        listeners: {
          stdout: (data: Buffer) => {
            stdall += data.toString()
          },
          stderr: (data: Buffer) => {
            stdall += data.toString()
          }
        }
      }
    )

    return { ...execOutput, stdall }
  }
}

export function findAya(): Aya {
  const versions = tc.findAllVersions(ayaToolName)
  if (versions.length == 0) throw new Error('No aya is found')
  const ayaHome = tc.find(ayaToolName, versions[0])
  const ayaJar = path.join(ayaHome, cliFileName)
  if (!fs.existsSync(ayaJar)) {
    throw new Error(`Aya isn't properly installed: not found ${ayaJar}`)
  }

  return new Aya(ayaJar)
}
