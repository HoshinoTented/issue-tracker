import { GITHUB_ACTION_BOT_ID } from './constants.js'
import { SetupResult } from './types.js'
import github from '@actions/github'
import exec from '@actions/exec'

function prReportPrefix(issue: number): string {
  return `<!-- #${issue} -->`
}

/**
 * Make a report, ends with new line
 * @param setupResult the project setup result
 * @param trackerWd project root
 * @param output the output of run
 * @returns report
 */
export function makeReport(
  setupResult: SetupResult,
  output: exec.ExecOutput & { stdall: string },
  linked?: number
): string {
  // TODO: extends to multi-version case, but this is good for now.
  const fileList = setupResult.files.map((v) => '`' + v + '`').join(' ')
  const prefix = linked ? `${prReportPrefix(linked)}\n` : ''
  return (
    prefix +
    `
  The following aya files are detected: ${fileList}
  Aya Version: \`${setupResult.version}\`

  Exit code: ${output.exitCode}
  Output:
  \`\`\`plaintext
  ${output.stdall}
  \`\`\`
  `
  )
}

/**
 * @param pr if not-null, then publish report to pull request instead of issue
 */
export async function publishReport(
  token: string,
  owner: string,
  repo: string,
  issue: number,
  report: string,
  pr?: number
) {
  const octokit = github.getOctokit(token)

  const target = pr || issue

  // issue and pulls share some api
  const { data: comments } = await octokit.rest.issues.listComments({
    owner: owner,
    repo: repo,
    issue_number: target
  })

  const foundComment = comments.filter(
    (c) => c.user?.id == GITHUB_ACTION_BOT_ID
  )
  let foundCommentId: number | null

  if (foundComment.length == 0) {
    foundCommentId = null
  } else {
    if (pr == null) {
      // target == issue
      // check if [foundComment] has length 1
      if (foundComment.length > 1) {
        throw new Error(
          `Expecting 1 comment of issue #${issue}, but got ${foundComment.length}`
        )
      } else {
        foundCommentId = foundComment[0].id
      }
    } else {
      // target == pr
      const found = foundComment.find((it) =>
        it.body?.startsWith(prReportPrefix(issue))
      )
      if (found == undefined) {
        foundCommentId = null
      } else {
        foundCommentId = found.id
      }
    }
  }

  if (foundCommentId == null) {
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
      comment_id: foundCommentId,
      body: report
    })
  }
}
