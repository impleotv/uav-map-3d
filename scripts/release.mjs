import {spawnSync} from "node:child_process";
import release from "release-it";

// Policy lives in .release-it.json. Prevent tokenless manual-web fallback.
const args = process.argv.slice(2).filter(Boolean);
const preview = args.includes("--preview");
const versions = args.filter(arg => arg !== "--preview");
try {
  if (versions.length > 1 || (versions[0] && !/^(?:major|minor|patch|(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.test(versions[0]))) {
    throw new Error("Usage: npm run release -- [major|minor|patch|X.Y.Z] [--preview]");
  }
  if (!preview) {
    if (!process.env.GITHUB_TOKEN) {
      const auth = spawnSync("gh", ["auth", "token"], {encoding: "utf8"});
      if (auth.status !== 0 || !auth.stdout?.trim()) {
        throw new Error("Sign in with `gh auth login`, or set GITHUB_TOKEN with repository contents write access before publishing.");
      }
      process.env.GITHUB_TOKEN = auth.stdout.trim();
    }
    const status = spawnSync("git", ["status", "--porcelain"], {encoding: "utf8"});
    if (status.status !== 0) throw new Error("Unable to inspect Git working tree.");
    if (status.stdout.trim()) throw new Error("Commit or stash all changes (including untracked files) before releasing.");
  }
  await release({
    ci: true,
    ...(versions[0] ? {increment: versions[0]} : {}),
    ...(preview ? {
      "dry-run": true,
      github: false,
      git: {push: false, requireCleanWorkingDir: false, requireUpstream: false, requireCommits: false}
    } : {})
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
