import * as core from '@actions/core'
import * as github from '@actions/github'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const issue = core.getInput('issue')
    core.info('Input issue: ' + issue)

    let number = github.context.issue.number
    if (number == undefined) number = -1
    core.info('Obtained issue number: ' + number)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
