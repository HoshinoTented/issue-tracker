import { PrReport, RichExecOutput, SetupResult } from './types.js'

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
