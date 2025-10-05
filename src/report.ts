import { GITHUB_ACTION_BOT_ID } from './constants.js'
import { PrReport, SetupResult } from './types.js'
import github from '@actions/github'
import exec from '@actions/exec'

/**
 * Make a report, ends with new line
 * @param setupResult the project setup result
 * @param trackerWd project root
 * @param output the output of run
 * @returns report
 */
export function makeReport(
  setupResult: SetupResult,
  output: exec.ExecOutput & { stdall: string }
): string {
  // TODO: extends to multi-version case, but this is good for now.
  const fileList = setupResult.files.map((v) => '`' + v + '`').join(' ')
  return `
The following aya files are detected: ${fileList}
Aya Version: \`${setupResult.version}\`

Exit code: ${output.exitCode}
Output:
\`\`\`plaintext
${output.stdall}
\`\`\`
`
}

export function makePrReport(reports: PrReport[]): string {
  return reports
    .map(
      (v) => `
## #${v.issue}

${v.report}`
    )
    .join('\n')
}

/**
 * @param pr if not-null, then publish report to pull request instead of issue
 */
export async function publishReport(
  token: string,
  owner: string,
  repo: string,
  issue: number,
  report: string
) {
  const octokit = github.getOctokit(token)

  // issue and pulls share some api
  const { data: comments } = await octokit.rest.issues.listComments({
    owner: owner,
    repo: repo,
    issue_number: issue
  })

  const foundComment = comments.find((c) => c.user?.id == GITHUB_ACTION_BOT_ID)

  if (foundComment == undefined) {
    await octokit.rest.issues.createComment({
      owner: owner,
      repo: repo,
      issue_number: issue,
      body: report
    })
  } else {
    await octokit.rest.issues.updateComment({
      owner: owner,
      repo: repo,
      comment_id: foundComment.id,
      body: report
    })
  }
}
