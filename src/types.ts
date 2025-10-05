import exec from '@actions/exec'

export type SetupResult = {
  version: string | null
  files: string[]
}

export type RichExecOutput = exec.ExecOutput & { stdall: string }

export type TrackResult = {
  setupResult: SetupResult
  execResult: RichExecOutput
} | null

export type PrReport = {
  issue: number
  report: string
}
