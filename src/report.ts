import { GITHUB_ACTION_BOT_ID } from './constants.js'
import {
  PrReport,
  RichExecOutput,
  SetupResult,
  TrackerContext
} from './types.js'
import github from '@actions/github'

/**
 * Make a report, ends with new line
 * @param setupResult the project setup result
 * @param output the output of run
 */
export function makeReport(
  setupResult: SetupResult,
  output: RichExecOutput
): string {
  // TODO: extends to multi-version case, but this is good for now.
  const fileList = setupResult.files.map((v) => '`' + v + '`').join(' ')
  return `The following aya files are detected: ${fileList}
Aya Version: \`${setupResult.version}\`

Exit code: ${output.exitCode}
Output:
\`\`\`plaintext
${output.stdall}
\`\`\``
}

export function makePrReport(reports: PrReport[]): string {
  return reports
    .map(
      (v) => `## #${v.issue}

${v.report}`
    )
    .join('\n')
}

/**
 * @param issue the issue/pull request number which the report publish to
 */
export async function publishReport(
  ctx: TrackerContext,
  issue: number,
  report: string
) {
  const octokit = github.getOctokit(ctx.token)

  // issue and pulls share some api
  const { data: comments } = await octokit.rest.issues.listComments({
    owner: ctx.owner,
    repo: ctx.repo,
    issue_number: issue
  })

  const foundComment = comments.find((c) => c.user?.id == GITHUB_ACTION_BOT_ID)

  if (foundComment == undefined) {
    await octokit.rest.issues.createComment({
      owner: ctx.owner,
      repo: ctx.repo,
      issue_number: issue,
      body: report
    })
  } else {
    await octokit.rest.issues.updateComment({
      owner: ctx.owner,
      repo: ctx.repo,
      comment_id: foundComment.id,
      body: report
    })
  }
}
