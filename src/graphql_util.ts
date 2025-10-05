import github from '@actions/github'
import { TRACKING_LABEL } from './constants.js'

export async function collectLinkedIssues(
  token: string,
  owner: string,
  repo: string,
  pr: number
): Promise<number[]> {
  const octokit = github.getOctokit(token)
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
    { owner, name: repo, pr }
  )

  return resp.repository.pullRequest.closingIssuesReferences.nodes
    .filter(
      (it) =>
        !it.closed && it.labels.nodes.some((ls) => ls.name == TRACKING_LABEL)
    )
    .map((it) => it.number)
}
