# Issue Tracker for Aya

[![GitHub Super-Linter](https://github.com/HoshinoTented/issue-tracker/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/aHoshinoTented/issue-tracker/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/HoshinoTented/issue-tracker/actions/workflows/check-dist.yml/badge.svg)](https://github.com/HoshinoTented/issue-tracker/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/HoshinoTented/issue-tracker/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/HoshinoTented/issue-tracker/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

Issue Tracker uses Github Actions to keep tracking to issues with aya codes.

## How to use

For automatically track issues on issue creation and main branch update, see
[workflow file](.github/workflows/main.yml), or:

```yml
on:
  push:
    branches: [main]
  issues:
    types: [opened]

jobs:
  run-tracker:
    # don't run on invalid issues
    if: ${{ github.event.issue == null && true || startsWith(github.event.issue.body, '<!-- ISSUE TRACKER ENABLE -->') }}
    permissions:
      # other permission here...
      contents: read
      # make sure you have the write permission to issues
      issues: write

    name: Run Tracker
    runs-on: ubuntu-latest
    steps:
      # setup aya first
      - name: setup aya
        uses: 'HoshinoTented/setup-aya@main'
        with:
          refs: 'issue-checker'
    - name: checkout
      uses: 'actions/checkout@v4'
    - name: run tracker
      uses: 'HoshinoTented/issue-tracker@main'
      with:
        # used for retriving information from github, and submit comment/add or remove labels
        token: ${{ secrets.GITHUB_TOKEN }}
        # the issue number, can be empty, but issue-tracker can handle it
        issue: ${{ github.event.issue.number }}
```

For automatically track linked issues on pull request branch update:

```yml
on:
  pull_request:
    branches: [main]
  merge_group:
    types: [checks_requested]

jobs:
  run-tracker:
    runs-on: ubuntu-latest
    permissions:
      issues: read
      pull-requests: write
    steps:
      # Setup Aya is quite expensive, you can replace this step by using previously built aya
      - name: Setup Aya
        uses: 'HoshinoTented/setup-aya@v1'
      - name: Track Linked Issues
        uses: 'HoshinoTented/issue-tracker@v1'
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          issue: ${{ github.event.pull_request.number }}
          pull_request: true
```

## Prerequirement

- a `cli-fatjar.jar` must be installed at
  `$RUNNER_TOOL_CACHE/aya/ANY_VERSION/$RUNNER_ARCH` by `@actions/tool-cache`
- no files or directory named `issue-tracker-dir` exist in the current working
  directory.
