import * as core from '@actions/core'
import * as io from '@actions/io'
import path from 'path'
import { promises as fs, existsSync } from 'fs'

import { Aya, findAya, IssueSetupOutput } from './aya.js'
import { PrReport, SetupResult, TrackerContext, TrackResult } from './types.js'
import { TRACK_DIR, ISSUE_FILE } from './constants.js'
import { makePrReport, makeReport } from './report.js'
import {
  collectLinkedIssues,
  getIssueBody,
  listRepoTrackedIssues,
  markIssueAsTracking,
  publishReport
} from './github_util.js'

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

      const issueList = await listRepoTrackedIssues(ctx)

      for (const number of issueList) {
        // maybe we can reuse `i` instead of query again, but i can't find the type of `i`
        // ^ RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"] of '@octokit/plugin-rest-endpoint-methods'
        // ^ Never mind
        const success = await trackOneAndReport(ctx, aya, number, false)
        if (!success) {
          invalids.push(number)
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
    const body = await getIssueBody(ctx, issue)

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
          await markIssueAsTracking(ctx, issue)
        }

        // TODO: we need to setup aya of target version, but we have nightly only
        core.info('Run test library')
        const output = await aya.execOutput(
          ctx.timeout,
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
    } else {
      core.info(`The content of issue #${issue} is null`)
      return null
    }
  })
}

/**
 * Setup track environment, basically mkdir
 * @param wd current working directory
 * @param track_dir the path to the working directory of issue tracker, can be either relative or absolute
 */
async function setupTrackEnv(wd: string, track_dir: string): Promise<string> {
  // path.resolve == track_dir if track_dir is absolute
  const p = path.resolve(wd, track_dir)
  if (existsSync(p)) {
    core.debug('Clean working directory: ' + p)
    io.rmRF(p)
  }

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

  const { exitCode: exitCode } = await aya.execOutput(
    null,
    '--setup-issue',
    issueFile,
    '-o',
    trackDir
  )

  if (exitCode != 0) {
    return null
  }

  const metadata = await fs.readFile(
    path.join(trackDir, 'metadata.json'),
    'utf-8'
  )
  // TODO: maybe validate?
  const output: IssueSetupOutput = JSON.parse(metadata)

  let versionString = null
  if (output.version != null) {
    versionString = `${output.version.major}.${output.version.minor}.${output.version.patch}`
    if (output.version.snapshot) {
      versionString = versionString + '-SNAPSHOT'
    }
  }

  return {
    version: versionString,
    files: output.files
  }
}
