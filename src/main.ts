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
    const dry_run = core.getBooleanInput('dry-run')

    let issue_number: number | undefined
    if (issue == '' || issue == 'ALL') issue_number = undefined
    else issue_number = parseInt(issue)

    if (pull_request && issue_number == undefined) {
      throw new Error(
        "Must supply 'issue' when 'pull_request' is set to 'true'"
      )
    }

    track(
      {
        token,
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        dry_run
      },
      pull_request ? undefined : issue_number,
      pull_request ? issue_number : undefined
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
