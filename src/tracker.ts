import * as core from '@actions/core'
import * as github from '@actions/github'
import * as io from '@actions/io'
import path from 'path'
import { promises as fs } from 'fs'

import { Aya, findAya } from './find_aya.js'
import { SetupResult } from './types.js'
import { TRACKING_LABEL, TRACK_DIR, ISSUE_FILE } from './constants.js'
import { makeReport, publishReport } from './report.js'

export async function track(
  token: string,
  owner: string,
  repo: string,
  issue?: number
) {
  const aya = findAya()
  const fails: number[] = []

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
      // maybe we can reuse `i` instead of query again, but i can't find the type of `i`
      // ^ RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"] of '@octokit/plugin-rest-endpoint-methods'
      const success = await trackOne(aya, token, owner, repo, i.number, false)
      if (!success) {
        fails.push(i.number)
      }
    }
  } else {
    const success = await trackOne(aya, token, owner, repo, issue, true)
    if (!success) {
      fails.push(issue)
    }
  }

  if (fails.length > 0) {
    throw new Error(
      'The following issue was marked as tracking but fails to track: ' +
        fails.map((n) => '#' + n).join(' ')
    )
  }
}

/**
 * Assumptions: issue has tracking label if `mark == false`, otherwise issue has no tracking label
 * @param mark whether mark the issue as tracking, should be false if issue-tracker is triggered by push on main branch
 * @return if track success, track fail if issue tracker is not enabled for the given issue.
 */
async function trackOne(
  aya: Aya,
  token: string,
  owner: string,
  repo: string,
  issue: number,
  mark: boolean
): Promise<boolean> {
  return core.group('#' + issue, async () => {
    const octokit = github.getOctokit(token)

    const { data: issueData } = await octokit.rest.issues.get({
      owner: owner,
      repo: repo,
      issue_number: issue
    })

    const body = issueData.body

    if (body != null && body != undefined) {
      const wd = process.cwd()
      core.info('Setup tracker working directory')
      const trackerWd = await setupTrackEnv(wd)
      core.info('Parse and setup test library')
      const setupResult = await parseAndSetupTest(aya, wd, trackerWd, body)

      if (setupResult != null) {
        core.info('Setup test library successful')
        if (mark) {
          core.info(`Mark issue #${issue} as tracking`)
          await octokit.rest.issues.addLabels({
            owner: owner,
            repo: repo,
            issue_number: issue,
            labels: [TRACKING_LABEL]
          })
        }

        // TODO: we need to setup aya of target version, but we have nightly only
        core.info('Run test library')
        const output = await aya.execOutput(
          '--remake',
          '--ascii-only',
          '--no-color',
          trackerWd
        )

        core.info('Make and publish report')
        const report = makeReport(setupResult, output)
        await publishReport(token, owner, repo, issue, report)
        return true
      } else {
        core.info(
          'No test library was setup, issue-tracker may be disabled or something is wrong'
        )
        // Don't untrack the issue even project setup fails, but we fails the job
        return false
      }
    }

    return false
  })
}

/**
 * Setup track environment, basically mkdir
 */
async function setupTrackEnv(wd: string): Promise<string> {
  const p = path.join(wd, TRACK_DIR)
  await io.mkdirP(p)
  return p
}

/**
 * Setup aya project that content describes
 *
 * @param wd working directory
 * @param trackDir directory that will be used for setting up aya project
 * @param content the content of the issue
 * @returns null if unable to setup aya project, this can be either the issue doesn't enable issue-tracker, or something is wrong;
 *          aya version is returned if everything is fine.
 */
async function parseAndSetupTest(
  aya: Aya,
  wd: string,
  trackDir: string,
  content: string
): Promise<SetupResult | null> {
  const issueFile = path.join(wd, ISSUE_FILE)
  await fs.writeFile(issueFile, content)

  const { exitCode: exitCode, stdout: stdout } = await aya.execOutput(
    '--setup-issue',
    issueFile,
    '-o',
    trackDir
  )

  if (exitCode != 0) {
    return null
  }

  // not sure if this works on windows/macOS
  const lines = stdout.split('\n')
  if (lines.length < 2) {
    throw new Error('Broken output while setting up issue project:\n' + stdout)
  }

  const [version, rawFiles] = lines
  const files = rawFiles ? [] : rawFiles.split(' ')

  return {
    version: version == 'null' ? null : version,
    files: files
  }
}
