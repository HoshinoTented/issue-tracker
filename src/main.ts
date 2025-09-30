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
    const issue = core.getInput('issue')
    const token = core.getInput('token')

    let issue_number: number | undefined
    if (issue == '' || issue == 'ALL') issue_number = undefined
    else issue_number = parseInt(issue)

    track(
      token,
      github.context.repo.owner,
      github.context.repo.repo,
      issue_number
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
