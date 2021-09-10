# @ampproject/npw

> A workspace-aware npm wrapper to aid with developing in monorepos

`npw` aids when developing a sub-package inside a [npm workspace][workspaces]
monorepo. It allows you to cd into your sub-package and perform
workspace-aware operations without you having to cd back into the
monorepo root to perform the operation.

Imagine you have the following workspace setup:

```
monorepo/
  packages/
    project-1/
      package.json
    project-2/
      package.json   // { "dependencies": { "project-1": * } }
  package.json       // { "workspaces": [ "./packages/*" ] }
```

If you `cd monorepo` and run `npm install`, everything will work fine.
But if you `cd packages/project-2` and try running `npm install` again,
you'll get a failure that `project-1` cannot be resolved. This is
because npm isn't aware you're working in a workspace's sub-package, so
it doesn't know that `project-1` is in the parent directory.

`npw` fixes this. When you run `npw install`, it will figure out where
the monorepo root is and perform the correct `npm install -w packages/project-2`
so that npm is aware of the workspace.

## Installation

```bash
$ npm install -g @ampproject/npw
```

## Usage

`npw` is a simple wrapper around npm, and can be invoked with any
command that npm supports.


```bash
$ npw install --save-dev prettier

$ npw start
```

[workspaces]: https://docs.npmjs.com/cli/v7/using-npm/workspaces
