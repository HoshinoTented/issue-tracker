import * as core from '@actions/core'
import * as github from '@actions/github'

const TRACKING_LABEL = 'tracking'

export async function track(
  token: string,
  owner: string,
  repo: string,
  issue?: number
) {
  if (issue == undefined) {
    core.info("'issue' is not specified, re-run all tracked issues.")

    const octokit = github.getOctokit(token)
    const { data: issueList } = await octokit.rest.issues.listForRepo({
      owner: owner,
      repo: repo,
      state: 'open',
      labels: TRACKING_LABEL
    })

    for (const i of issueList) {
      // maybe we can reuse `i` instead of query again, but i can't find tht type of `i`
      await trackOne(token, owner, repo, i.number, false)
    }
  } else {
    await trackOne(token, owner, repo, issue, true)
  }
}

/**
 * @param mark whether mark the issue as tracking, should be false if issue-tracker is triggered by push on main branch
 */
async function trackOne(
  token: string,
  owner: string,
  repo: string,
  issue: number,
  mark: boolean
): Promise<void> {
  core.info((mark ? 'Track' : 'Re-run') + ' issue #' + issue)

  const octokit = github.getOctokit(token)

  let job = null

  if (mark) {
    // FIXME: Don't mark until aya says it enables issue tracker, but for now we just mark for all
    job = octokit.rest.issues.addLabels({
      owner: owner,
      repo: repo,
      issue_number: issue,
      labels: [TRACKING_LABEL]
    })
  }

  const { data: issueData } = await octokit.rest.issues.get({
    owner: owner,
    repo: repo,
    issue_number: issue
  })

  core.info('Tracking: ' + issue)
  core.info('' + issueData.body)
  if (job != null) await job
}
