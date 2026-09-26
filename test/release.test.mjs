import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(readFileSync(new URL("../.release-it.json", import.meta.url)));
const releaseModule = import.meta.resolve("release-it");

function fixture(messages) {
  mkdirSync(path.join(root, ".cache"), {recursive: true});
  const cwd = mkdtempSync(path.join(root, ".cache", "release-test-"));
  const run = (command, args) => {
    const result = spawnSync(command, args, {cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024});
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout;
  };
  const git = (...args) => run("git", args);
  git("init", "--initial-branch=main");
  git("config", "user.name", "Release Test");
  git("config", "user.email", "release-test@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "tag.gpgsign", "false");
  // A local remote exercises fetch/tag handling without network publication.
  git("init", "--bare", "remote.git");
  git("remote", "add", "origin", path.join(cwd, "remote.git"));
  writeFileSync(path.join(cwd, ".gitignore"), "remote.git/\n");
  const pkg = {name: "release-fixture", version: "1.0.0", repository: {type: "git", url: "https://github.com/impleotv/uav-map-3d.git"}};
  writeFileSync(path.join(cwd, "package.json"), JSON.stringify(pkg));
  writeFileSync(path.join(cwd, "package-lock.json"), JSON.stringify({name: pkg.name, version: pkg.version, lockfileVersion: 3, packages: {"": {name: pkg.name, version: pkg.version}}}));
  writeFileSync(path.join(cwd, "CHANGELOG.md"), "# Changelog\n\n## 1.0.0\n\nHistorical entry to preserve.\n");
  writeFileSync(path.join(cwd, ".release-it.json"), JSON.stringify({
    ...config, hooks: {}, github: false,
    npm: {...config.npm, skipChecks: true},
    git: {...config.git, push: false, requireUpstream: false}
  }));
  git("add", ".");
  git("commit", "-m", "chore: initial fixture");
  git("tag", "v1.0.0");
  git("push", "origin", "HEAD", "--tags");
  for (const message of messages) git("commit", "--allow-empty", "-m", message);
  const release = (options = {}) => run(process.execPath, ["--input-type=module", "-e",
    `import release from ${JSON.stringify(releaseModule)}; await release(${JSON.stringify({ci: true, ...options})});`]);
  return {cwd, git, release, read: name => readFileSync(path.join(cwd, name), "utf8")};
}

test("release groups conventional commits, updates lockfile and preserves history", () => {
  const repo = fixture(["feat(scene): add terrain mode", "fix(camera): correct heading", "chore: update tooling"]);
  repo.release();
  assert.equal(JSON.parse(repo.read("package.json")).version, "1.1.0");
  assert.equal(JSON.parse(repo.read("package-lock.json")).packages[""].version, "1.1.0");
  const changelog = repo.read("CHANGELOG.md");
  for (const text of ["Features", "Bug Fixes", "Maintenance", "add terrain mode", "correct heading", "update tooling", "Historical entry to preserve."]) assert.ok(changelog.includes(text), text);
  assert.match(repo.git("show", "v1.1.0:CHANGELOG.md"), /add terrain mode/);
  assert.equal(repo.git("status", "--porcelain").trim(), "");
});

test("maintenance alone does not release; explicit patch includes maintenance", () => {
  const repo = fixture(["chore: update tooling"]);
  repo.release();
  assert.equal(JSON.parse(repo.read("package.json")).version, "1.0.0");
  repo.release({increment: "patch"});
  assert.equal(JSON.parse(repo.read("package.json")).version, "1.0.1");
  assert.match(repo.read("CHANGELOG.md"), /Maintenance/);
});

test("fix gives patch, breaking changes give major, and preview leaves files untouched", () => {
  const repo = fixture(["fix: correct heading"]);
  const before = repo.read("CHANGELOG.md");
  const preview = repo.release({"dry-run": true});
  assert.match(preview, /1\.0\.1/);
  assert.equal(repo.read("CHANGELOG.md"), before);
  assert.equal(JSON.parse(repo.read("package.json")).version, "1.0.0");
  assert.equal(repo.git("tag", "--list", "v1.0.1").trim(), "");
  repo.git("commit", "--allow-empty", "-m", "feat!: change scene API");
  repo.release();
  assert.equal(JSON.parse(repo.read("package.json")).version, "2.0.0");
  assert.match(repo.read("CHANGELOG.md"), /BREAKING CHANGE/);
});
