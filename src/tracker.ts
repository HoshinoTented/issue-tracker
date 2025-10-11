import * as core from '@actions/core'
import * as github from '@actions/github'
import * as io from '@actions/io'
import path from 'path'
import { promises as fs } from 'fs'

import { Aya, findAya } from './find_aya.js'
import { PrReport, SetupResult, TrackerContext, TrackResult } from './types.js'
import { TRACKING_LABEL, TRACK_DIR, ISSUE_FILE } from './constants.js'
import { makePrReport, makeReport, publishReport } from './report.js'
import { collectLinkedIssues } from './graphql_util.js'

/**
 * @param issue the issue to track, null if track all
 * @param pr set if triggered by head ref update of pull request, in this case, track will set error if any linked issue is failed
 */
export async function track(ctx: TrackerContext, issue?: number, pr?: number) {
  const aya = findAya()
  const invalids: number[] = []
  const fails: number[] = []

  if (issue == undefined) {
    if (pr == undefined) {
      // trigerred by master branch update
      core.info("'issue' is not specified, re-run all tracked issues.")

      const octokit = github.getOctokit(ctx.token)
      const { data: issueList } = await octokit.rest.issues.listForRepo({
        owner: ctx.owner,
        repo: ctx.repo,
        state: 'open',
        labels: TRACKING_LABEL
      })

      for (const i of issueList) {
        // maybe we can reuse `i` instead of query again, but i can't find the type of `i`
        // ^ RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"] of '@octokit/plugin-rest-endpoint-methods'
        const success = await trackOneAndReport(ctx, aya, i.number, false)
        if (!success) {
          invalids.push(i.number)
        }
      }
    } else {
      // triggered by pr branch update
      core.info('Track all linked issues of pull request #' + pr)
      const issueList = await collectLinkedIssues(ctx, pr)
      const reports: PrReport[] = []

      for (const i of issueList) {
        const result = await trackOne(ctx, aya, i, false)
        if (result == null) {
          invalids.push(i)
        } else {
          if (result.execResult.exitCode != 0) {
            fails.push(i)
          }

          reports.push({
            issue: i,
            report: makeReport(result.setupResult, result.execResult)
          })
        }
      }

      // still publish report even there are invalid issues

      if (reports.length != 0) {
        core.info('Make and publish report')
        const report = makePrReport(reports)
        await publishReport(ctx, pr, report)
      } else {
        core.info(
          'No reports, can be either no linked issues or all issues are failed to setup'
        )
      }
    }
  } else {
    // triggered by issue creation
    const result = await trackOneAndReport(ctx, aya, issue, true)
    if (result == null) {
      invalids.push(issue)
    }
  }

  if (invalids.length > 0) {
    core.setFailed(
      'The following issues were marked as tracking but fail to track: ' +
        invalids.map((n) => '#' + n).join(' ')
    )
  }

  if (fails.length > 0) {
    core.setFailed(
      'The following issues fail: ' + fails.map((n) => '#' + n).join(' ')
    )
  }
}

async function trackOneAndReport(
  ctx: TrackerContext,
  aya: Aya,
  issue: number,
  mark: boolean
): Promise<boolean> {
  const result = await trackOne(ctx, aya, issue, mark)
  if (result == null) return false

  core.info('Make and publish report')
  const report = makeReport(result.setupResult, result.execResult)

  await publishReport(ctx, issue, report)

  return true
}

/**
 * Assumptions: issue has tracking label if `mark == false`, otherwise issue has no tracking label
 * @param mark whether mark the issue as tracking, should be false if issue-tracker is triggered by push on main branch
 * @return if track success, track fail if issue tracker is not enabled for the given issue.
 */
async function trackOne(
  ctx: TrackerContext,
  aya: Aya,
  issue: number,
  mark: boolean
): Promise<TrackResult> {
  return core.group('#' + issue, async () => {
    const octokit = github.getOctokit(ctx.token)

    const { data: issueData } = await octokit.rest.issues.get({
      owner: ctx.owner,
      repo: ctx.repo,
      issue_number: issue
    })

    const body = issueData.body

    if (body != null && body != undefined) {
      const wd = process.cwd()
      core.info('Setup tracker working directory')
      const trackerWd = await setupTrackEnv(wd, TRACK_DIR)
      core.info('Parse and setup test library')
      const setupResult = await parseAndSetupTest(aya, wd, trackerWd, body)

      if (setupResult != null) {
        core.info('Setup test library successful')
        if (mark) {
          core.info(`Mark issue #${issue} as tracking`)
          await octokit.rest.issues.addLabels({
            owner: ctx.owner,
            repo: ctx.repo,
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

        return {
          setupResult,
          execResult: output
        }
      } else {
        core.info(
          'No test library was setup, issue-tracker may be disabled or something is wrong'
        )
        // Don't untrack the issue even project setup fails, but we fails the job
        return null
      }
    }

    return null
  })
}

/**
 * Setup track environment, basically mkdir
 */
async function setupTrackEnv(wd: string, track_dir: string): Promise<string> {
  // path.resolve == track_dir if track_dir is absolute
  const p = path.resolve(wd, track_dir)
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
 *          [SetupResult] is returned if everything is fine.
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
  const files = !rawFiles ? [] : rawFiles.split(' ')

  return {
    version: version == 'null' ? null : version,
    files: files
  }
}
