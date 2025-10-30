/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * To mock dependencies in ESM, you can create fixtures that export mock
 * functions and objects. For example, the core module is mocked in this test,
 * so that the actual '@actions/core' module is not imported.
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Mocks should be declared before the module being tested is imported.
jest.unstable_mockModule('@actions/core', () => core)

// The module being tested should be imported dynamically. This ensures that the
// mocks are used in place of any actual dependencies.
const { run } = await import('../src/main.js')

/* eslint-disable  @typescript-eslint/no-explicit-any */
function mockCoreInput(data: any) {
  core.getInput.mockImplementation((name) => {
    const result = data[name]
    if (result === undefined) {
      return ''
    } else {
      return result
    }
  })

  core.getBooleanInput.mockImplementation((name) => {
    const result = data[name]
    if (result == true) return true
    return false
  })
}

describe('main.ts', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test("fail on 'issue' == undefined && pull_request == true", async () => {
    const data = {
      pull_request: true
    }

    mockCoreInput(data)

    await run()

    expect(core.setFailed).toHaveBeenNthCalledWith(
      1,
      "Must supply 'issue' when 'pull_request' is set to 'true'"
    )
  })

  test("fail on invalid 'run-timeout'", async () => {
    const data = {
      run_timeout: 'aaa'
    }
    mockCoreInput(data)

    await run()
    expect(core.setFailed).toHaveBeenNthCalledWith(
      1,
      "value of 'run_timeout' is not a number: " + data['run_timeout']
    )
  })
})
