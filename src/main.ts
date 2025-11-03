import * as core from '@actions/core'
import * as github from '@actions/github'
import { track } from './tracker.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const token = core.getInput('token')
    const issue = core.getInput('issue')
    const pull_request = core.getBooleanInput('pull_request')
    const dry_run = core.getBooleanInput('dry_run')
    const timeout = core.getInput('run_timeout')

    let issue_number: number | undefined
    if (issue == '' || issue == 'ALL') issue_number = undefined
    else {
      issue_number = parseInt(issue)
      if (isNaN(issue_number)) {
        issue_number = undefined
      }
    }

    if (pull_request && issue_number == undefined) {
      throw new Error(
        "Must supply 'issue' when 'pull_request' is set to 'true'"
      )
    }

    let run_timeout: number | null = Number(timeout)
    if (isNaN(run_timeout)) {
      throw new Error("value of 'run_timeout' is not a number: " + timeout)
    } else if (run_timeout == 0) {
      core.info('Are you serious?')
      run_timeout = null
    } else if (run_timeout < 0) {
      run_timeout = null
    }

    track(
      {
        token,
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        dry_run,
        timeout: run_timeout
      },
      pull_request ? undefined : issue_number,
      pull_request ? issue_number : undefined
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
