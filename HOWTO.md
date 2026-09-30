# How to use UAV Map 3D


## Release

Releases publish the scoped package to GitHub Packages as well as creating a
GitHub tag and release. Before the first publish, a maintainer needs:

- Write access to the `@impleotv-pm` GitHub Packages namespace and push access
  to this repository.
- A personal access token (classic) with `write:packages` (and `read:packages`
  to install/verify the package). Configure npm authentication locally with
  `npm login --scope=@impleotv-pm --registry=https://npm.pkg.github.com --auth-type=legacy`;
  enter your GitHub username and use the token as the password. Keep the token
  out of this repository. GitHub release creation also needs `gh auth login`
  or `GITHUB_TOKEN` with repository contents write access.
- Node 22.21+ or 24+, npm, Git, GNU Make, and installed dependencies (`npm ci`).
  Commit changes and set an upstream branch before running the release.

Check package authentication and the planned version before publishing:

```sh
npm whoami --registry=https://npm.pkg.github.com
git fetch --tags
make release-preview
```

Then run:

```sh
make release
```

The release runs tests, type checks and package verification, then publishes
`@impleotv-pm/uav-map-3d` to GitHub Packages and creates the GitHub release.
Verify the published version with
`npm view @impleotv-pm/uav-map-3d version --registry=https://npm.pkg.github.com`.
`npm publish` cannot replace an existing version. If publishing succeeds but a
later release step fails, inspect the tag, GitHub release and package version
before retrying; do not publish a second tarball under the same version.

Version `0.5.0` was tagged before registry publishing was added. To make that
version available, publish the package once from a clean checkout of the
existing `v0.5.0` tag:

```sh
npm ci
make publish
```

to log in 
npm login --scope=@impleotv-pm --registry=https://npm.pkg.github.com --auth-type=legacy --offline=false
Username - impleotv-pm
Password - GITHUB_PM token

`make publish` publishes the version in the current `package.json` without
creating a commit, tag or GitHub release. Check the version and checkout before
running it; GitHub Packages will reject a version that already exists.
Do not rerun `make release` to backfill it or move the tag. After it is visible
in the registry, consumers can use a semver dependency such as `^0.5.0`.

## Skills

The library includes a portable `uav-map-3d` [Agent Skill](https://agentskills.io/specification)
for agents integrating scenes, telemetry, detections, map providers, and optional
React editors. It contains instructions and focused references, and does not
require a plugin, MCP server, or the CesiumJS skills collection.

Install the library separately using the dependency instructions in
[README.md](README.md). Installing a skill does not install the library or Cesium.

### Install from GitHub

After the skill files are published to this repository, run this in the consuming
project and select your agent when prompted:

```sh
npx skills add impleotv/uav-map-3d --skill uav-map-3d --agent '*'
```

Run this in a regular terminal to get the standard Skills banner, progress
indicators, agent/scope selection prompts, and installation summary, just like
installing the CesiumJS skills. This display is provided by the `skills` CLI;
no custom installer is needed. When run by an AI agent or through captured output,
the CLI may suppress the banner and interactive prompts. `--list` only previews
discovery and does not show a completed installation.

For the same automatic installation flow as `--all`, while selecting only this
library's skill, use:

```sh
npx skills add impleotv/uav-map-3d --skill uav-map-3d --agent '*' --yes
```

This installs the selected skill for all supported agents at project scope and
skips confirmation prompts, while retaining the CLI's installation output.
Avoid repository-wide `--all` here: this repository also contains CesiumJS
development skills, which that option would select along with `uav-map-3d`.

The skill files must be available on the selected repository revision. Private
repository access uses your existing Git credentials. This change alone does not
publish a release. To list available skills without installing:

```sh
npx skills add impleotv/uav-map-3d --list
```

### Install the bundled skill

Packages containing this change include the skill alongside their runtime files.
From the consuming project, after installing such a package:

```sh
npx skills add ./node_modules/@impleotv-pm/uav-map-3d/skills/uav-map-3d --skill uav-map-3d --copy
```

Use your package manager's actual package location if it differs. Copying avoids
leaving a skill symlink dependent on a replaceable node_modules directory. To list
the bundled skill without installing, replace `--skill uav-map-3d --copy` with
`--list`. See the [skills installer documentation](https://github.com/vercel-labs/skills)
for agent selection and project versus global installation.

For manual installation, copy the entire `skills/uav-map-3d` folder, including
`references/`, into your agent's supported project skill directory. The result
must be `<skill-directory>/uav-map-3d/SKILL.md`. Discovery locations and reload
behavior vary by agent; follow that agent's instructions. Merely installing the
library into node_modules does not automatically activate the skill.

### Use and maintain

Example requests after installation:

- “Use the uav-map-3d skill to add an offline UAV scene to this Vite application.”
- “Display our normalized aircraft telemetry and detection targets on the map.”
- “Add the library's React presentation editor using our existing settings store.”

Prefer the bundled skill when matching an installed library revision. A skill
installed from GitHub may describe newer APIs. Agents should inspect the installed
package exports, declarations, and locked revision/archive before using features.
Reinstall the bundled skill after a library upgrade; copied skills do not update
automatically. Some local snapshots share a version number, so compare the actual
revision and available exports rather than the version alone.

Maintainers should update the skill with API changes and run `npm run typecheck`
and `npm run verify:package`. Package verification checks bundled references and
compiles/builds their TypeScript examples against the packed library.
