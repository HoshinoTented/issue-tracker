# Issue Tracker for Aya

[![GitHub Super-Linter](https://github.com/HoshinoTented/issue-tracker/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/aHoshinoTented/issue-tracker/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/HoshinoTented/issue-tracker/actions/workflows/check-dist.yml/badge.svg)](https://github.com/HoshinoTented/issue-tracker/actions/workflows/check-dist.yml)
[![CodeQL](https://github.com/HoshinoTented/issue-tracker/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/HoshinoTented/issue-tracker/actions/workflows/codeql-analysis.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

Issue Tracker uses Github Actions to keep tracking to issues with aya codes.

## How to use

See [workflow file](.github/workflows/main.yml), or:

```yml
on:
  push:
    branches: [main]
  issues:
    types: [opened]

jobs:
  check-marker:
    name: Check Marker
    runs-on: ubuntu-latest
    steps:
      - name: check
        id: check
        run: |
          echo "continue=${{ github.event.issue == null && true || startsWith(github.event.issue.body, '<!-- ISSUE TRACKER ENABLE -->') }}" >> $GITHUB_OUTPUT
    outputs:
      continue: ${{ steps.check.outputs.continue }}
  run-tracker:
    needs: check-marker
    # don't run on invalid issues
    if: ${{ needs.check-marker.outputs.continue == 'true' }}
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

## Q & A

Q: How do I re-run the issue after editing?
A: Just re-run the corresponding workflow, we may support re-run issue by emotion after github support it.

