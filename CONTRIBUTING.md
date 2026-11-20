# Contributing

We maintain this repository with AI agents under the direction of Mathematic
maintainers.

## Propose a change

Reviewing an unsolicited pull request takes longer than implementing the same
change once we agree on the approach. Start a
[GitHub Discussion](https://github.com/mathematic-inc/connectrpc-sdk/discussions/new) before writing code, explain the
problem you want to solve, and wait for a maintainer to respond.

If Mathematic decides to make the change, a maintainer will have an agent open
the pull request. Please do not open one yourself.

When Mathematic implements a proposal, we will link the implementation pull
request to the Discussion and credit the Discussion's original author.

## Pull requests

GitHub restricts pull request creation to Mathematic maintainers and repository
collaborators with write, maintain, or admin access, plus authorized
maintenance agents.

## Local setup

Before you work in the repository, install the pinned tools, write the tool
settings and install the Git hooks:

```sh
mise install
mise run generate
hk install
```
