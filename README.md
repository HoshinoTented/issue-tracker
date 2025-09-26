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
  run-tracker:
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
