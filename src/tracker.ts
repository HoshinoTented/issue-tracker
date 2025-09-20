import * as core from '@actions/core'
import * as github from '@actions/github'

export function track(token: string, issue: string | 'ALL') {
  github.context.issue
  const octokit = github.getOctokit(token)
}
