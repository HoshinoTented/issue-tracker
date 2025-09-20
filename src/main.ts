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
    core.info(
      'Obtained issue number: ' + github.context.issue.number.toString()
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
