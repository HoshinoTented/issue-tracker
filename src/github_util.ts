import github from '@actions/github'
import core from '@actions/core'
import { GITHUB_ACTION_BOT_ID, TRACKING_LABEL } from './constants.js'
import { TrackerContext } from './types.js'

export async function collectLinkedIssues(
  ctx: TrackerContext,
  pr: number
): Promise<number[]> {
  const octokit = github.getOctokit(ctx.token)
  const resp = await octokit.graphql<{
    repository: {
      pullRequest: {
        closingIssuesReferences: {
          nodes: {
            closed: boolean
            number: number
            labels: {
              nodes: {
                name: string
              }[]
            }
          }[]
        }
      }
    }
  }>(
    `
    query collectLinkedIssues($owner: String!, $name: String!, $pr: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $pr) {
          closingIssuesReferences(first: 5) { # are you sure we have more than 5 linked issues?
            nodes {
              closed
              number
              labels(first: 10) {
                nodes {
                  name
                }
              }
            }
          }
        }
      }
    }
    `,
    { owner: ctx.owner, name: ctx.repo, pr }
  )

  return resp.repository.pullRequest.closingIssuesReferences.nodes
    .filter(
      (it) =>
        !it.closed && it.labels.nodes.some((ls) => ls.name == TRACKING_LABEL)
    )
    .map((it) => it.number)
}

function dryRunPrint(name: string, message?: string) {
  const title = 'Dry Run: ' + name
  if (message == null) {
    core.info(title)
  } else {
    core.group(title, async () => {
      core.info(message)
    })
  }
}

export async function markIssueAsTracking(ctx: TrackerContext, issue: number) {
  if (!ctx.dry_run) {
    const octokit = github.getOctokit(ctx.token)
    await octokit.rest.issues.addLabels({
      owner: ctx.owner,
      repo: ctx.repo,
      issue_number: issue,
      labels: [TRACKING_LABEL]
    })
  } else {
    dryRunPrint(`Mark Issue #${issue} As Tracking`)
  }
}

/**
 * @param issue the issue/pull request number which the report publish to
 */
export async function publishReport(
  ctx: TrackerContext,
  issue: number,
  report: string
) {
  if (!ctx.dry_run) {
    const octokit = github.getOctokit(ctx.token)

    // issue and pulls share some api
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: ctx.owner,
      repo: ctx.repo,
      issue_number: issue
    })

    const foundComment = comments.find(
      (c) => c.user?.id == GITHUB_ACTION_BOT_ID
    )

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
  } else {
    dryRunPrint(`Publish Report to Issue ${issue}`, report)
  }
}
