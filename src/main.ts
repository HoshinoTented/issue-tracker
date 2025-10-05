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
    const pull_request = core.getInput('pull_request')

    let issue_number: number | undefined
    if (issue == '' || issue == 'ALL') issue_number = undefined
    else issue_number = parseInt(issue)

    let is_pr = pull_request == 'true'

    if (is_pr && issue_number == undefined) {
      throw new Error(
        "Must supply 'issue' when 'pull_request' is set to 'true'"
      )
    }

    track(
      token,
      github.context.repo.owner,
      github.context.repo.repo,
      is_pr ? undefined : issue_number,
      is_pr ? issue_number : undefined
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
