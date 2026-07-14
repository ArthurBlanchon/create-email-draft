#!/usr/bin/env node
// Deploy publisher for GitHub Pages (gh-pages branch), single-widget repo.
//
// Adapted from the grist-widget-sdk monorepo's scripts/deploy/publish.mjs —
// same two channels, minus the multi-widget folder loop and manifest.json
// (there's only one widget here, so nothing to catalog):
//
//   release (push to main / workflow_dispatch)
//     - immutable  /<repo>/v<version>/   (built once, never overwritten)
//     - mutable    /<repo>/latest/       (alias to newest release)
//     - /<repo>/versions.json            (released-version index, newest first
//                                        -- read by the showcase hub/notice)
//
//   dev (push to dev)
//     - mutable    /<repo>/dev/          (+ version.json + self-reload)
//
// Design notes: dependency-free (node builtins only). Pure helpers are
// exported for testing; the CLI is a thin dispatch at the bottom.
//
// Subcommands:
//   plan     --site <dir> --repo <name> --event <push|workflow_dispatch>
//            --ref <ref> [--force]
//     Prints JSON { context: "release"|"dev", version?, base, skip }.
//     Release is skipped when v<version> already exists on gh-pages
//     (idempotence: re-pushing main without a version bump is a no-op).
//
//   place    --site <dir> --repo <name> --channel <release|dev>
//            [--version <v>] --dist <dir> --sha <sha> [--ref <ref>]
//     Copies a freshly built dist into the gh-pages tree.
//
//   remove   --site <dir>
//     Removes dev/ from the gh-pages tree (retire the dev URL when the `dev`
//     branch is deleted). Never touches a release or latest/.
//
//   finalize --site <dir> [--update-versions] [--push] [--commit-message <msg>]
//     Regenerates versions.json (release runs only) and commits + pushes the
//     gh-pages tree with a rebase-and-retry loop.
//
//   reset-branches [--repo-dir <dir>]
//     On a repo's first genuine release only (caller gates on plan()'s
//     firstRelease): prunes every branch except main/dev/gh-pages and
//     force-resets dev to main's current tip.

import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  cpSync,
} from "node:fs"
import { join, dirname } from "node:path"
import { execFileSync } from "node:child_process"

// ----------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ----------------------------------------------------------------------------

/** Absolute Pages base path for a channel, e.g. "/my-widget/v1.2.0/". */
export function basePathFor(repo, channel, version) {
  const leaf = channel === "dev" ? "dev" : `v${version}`
  return `/${repo}/${leaf}/`
}

/**
 * Was `versionDir` actually published by *this* repo's own pipeline? Checks
 * for a `showcase-meta.json` whose `repo` field matches -- not just that the
 * directory exists. A `gh-pages` branch manually seeded from another repo's
 * export (found live: a freshly-created widget repo's `gh-pages` already
 * contained `v<version>/` directories copied from the template repo it came
 * from, some with no meta file at all, one with a foreign `showcase-meta.json`
 * whose `sha` didn't belong to this repo's own history) would otherwise look
 * indistinguishable from a real prior release and get silently treated as
 * "already published" forever, permanently squatting on that version path.
 */
function isGenuineRelease(versionDir, repo) {
  const metaPath = join(versionDir, "showcase-meta.json")
  if (!existsSync(metaPath)) return false
  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8"))
    return meta.repo === repo
  } catch {
    return false
  }
}

/**
 * Whether this repo has ever genuinely published a release (a v<version>/
 * dir whose showcase-meta.json names this repo). Shared by `plan()` (forces
 * the first release to 0.0.1) and `cleanupForeignVersionsIfFirstRelease()`
 * (clears inherited v<version>/ noise) -- both need the exact same signal.
 */
function hasGenuineRelease(siteDir, repo) {
  return buildVersionsManifest(siteDir, repo).length > 0
}

/**
 * Build the release/dev plan from this repo's own package.json + the current
 * gh-pages tree. Release is skipped when its immutable v<version> dir was
 * genuinely published by this repo before (unless force), so re-pushing main
 * without a version bump is a no-op.
 */
export function plan(siteDir, repo, event, ref, { force = false } = {}) {
  const isRelease = event === "workflow_dispatch" || ref === "refs/heads/main" || ref === "main"
  if (!isRelease) {
    return { context: "dev", base: basePathFor(repo, "dev") }
  }
  const pkg = JSON.parse(readFileSync("package.json", "utf8"))
  // A repo's first genuine release always starts at 0.0.1, regardless of
  // whatever package.json's version field says -- found live: a repo copied
  // via GitHub's "Use this template" inherited "0.2.18" from the source
  // template repo's own main branch (itself a canary-stamped scaffold that
  // had been promoted there), instead of starting fresh. Once a repo has a
  // genuine release, this no longer applies -- its own version bumps are
  // its own responsibility from then on, same as `cleanupForeignVersionsIfFirstRelease`.
  const firstRelease = !hasGenuineRelease(siteDir, repo)
  const version = firstRelease ? "0.0.1" : pkg.version
  if (!version) throw new Error("package.json has no version")
  const versionDir = join(siteDir, `v${version}`)
  const exists = isGenuineRelease(versionDir, repo)
  return {
    context: "release",
    version,
    base: basePathFor(repo, "release", version),
    skip: exists && !force,
    reason: exists ? (force ? "force-rebuild" : "already-published") : "new-version",
    // Exposed so the workflow can gate a one-time repo cleanup (prune stray
    // branches, reset dev to main) on exactly this signal -- see
    // `resetBranchesIfFirstRelease`.
    firstRelease,
  }
}

/** The dev-only self-reload snippet, embedding this build's short SHA. */
export function selfReloadSnippet(sha) {
  return `<script>
/* grist-widget-sdk dev channel: auto-reload when a newer build is published. */
(function () {
  var CURRENT = ${JSON.stringify(sha)};
  var POLL_MS = 5000;
  async function check() {
    try {
      var res = await fetch("version.json?ts=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return;
      var data = await res.json();
      if (data && data.sha && data.sha !== CURRENT) {
        var url = new URL(location.href);
        url.searchParams.set("__dev", data.sha); // unique => busts Pages CDN + browser cache
        location.replace(url.toString());        // preserves Grist's own iframe query params
      }
    } catch (e) { /* transient offline / 404 during publish: keep polling */ }
  }
  setInterval(check, POLL_MS);
})();
</script>`
}

/** Insert the snippet just before </body> (or append if none). Idempotent-ish: strips a prior block first. */
export function injectSelfReload(html, sha) {
  const marker = "grist-widget-sdk dev channel"
  let out = html
  if (out.includes(marker)) {
    out = out.replace(/<script>\s*\/\* grist-widget-sdk dev channel[\s\S]*?<\/script>\s*/g, "")
  }
  const snippet = selfReloadSnippet(sha) + "\n"
  if (out.includes("</body>")) return out.replace("</body>", snippet + "</body>")
  return out + snippet
}

/**
 * Scan siteDir for previously-released v<version>/showcase-meta.json files
 * and assemble the versions.json manifest, newest first. Read by the
 * showcase hub (TemplateLanding) and per-channel notice (ChannelNotice) to
 * show this widget's own release history -- not the grist-widget-sdk
 * monorepo's (found live: every scaffolded widget's version index showed
 * the monorepo's versions instead of its own, since showcase-versions.ts
 * used to hardcode that URL). Entries whose meta has no `repo` field, or a
 * `repo` that doesn't match this repo, are skipped -- a `gh-pages` branch
 * manually seeded from another repo's export (found live) would otherwise
 * leak that repo's own version history into this one's index.
 */
export function buildVersionsManifest(siteDir, repo) {
  const entries = []
  for (const name of existsSync(siteDir) ? readdirSync(siteDir) : []) {
    if (!/^v\d+\.\d+\.\d+/.test(name)) continue
    const metaPath = join(siteDir, name, "showcase-meta.json")
    if (!existsSync(metaPath)) continue
    const meta = JSON.parse(readFileSync(metaPath, "utf8"))
    if (meta.repo !== repo) continue
    entries.push({ version: meta.version, publishedAt: meta.publishedAt })
  }
  entries.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
  return entries
}

// ----------------------------------------------------------------------------
// Filesystem / git effects
// ----------------------------------------------------------------------------

function replaceDir(dest, srcDist) {
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(srcDist, dest, { recursive: true })
}

/**
 * If this repo has never genuinely published a release before (no
 * v<version>/ directory whose showcase-meta.json matches this repo), any
 * v<version>/ directories present are provably inherited noise -- e.g. from
 * copying this template repo including its gh-pages branch (GitHub's "Use
 * this template" -> "Include all branches"). Safe to clear them all before
 * placing this repo's actual first release: there is no ambiguity, since a
 * repo with zero genuine releases can't have any of its own history to lose.
 * Never touches dev/, latest/, or site-root files. Once a genuine release
 * exists for this repo, buildVersionsManifest is non-empty and this is
 * permanently a no-op.
 */
export function cleanupForeignVersionsIfFirstRelease(siteDir, repo) {
  if (hasGenuineRelease(siteDir, repo)) return { cleaned: [] }
  const cleaned = []
  for (const name of existsSync(siteDir) ? readdirSync(siteDir) : []) {
    if (!/^v\d+\.\d+\.\d+/.test(name)) continue
    rmSync(join(siteDir, name), { recursive: true, force: true })
    cleaned.push(name)
  }
  return { cleaned }
}

/** Place a freshly built dist into the gh-pages tree. */
export function placeTarget({ siteDir, channel, version, distDir, sha, ref, repo }) {
  if (!existsSync(distDir)) throw new Error(`dist not found: ${distDir}`)
  if (channel === "dev") {
    const devDir = join(siteDir, "dev")
    replaceDir(devDir, distDir)
    writeFileSync(
      join(devDir, "version.json"),
      JSON.stringify({ sha, builtAt: new Date().toISOString(), ref: ref || null }, null, 2) + "\n",
    )
    const indexPath = join(devDir, "index.html")
    if (existsSync(indexPath)) {
      writeFileSync(indexPath, injectSelfReload(readFileSync(indexPath, "utf8"), sha))
    }
    return { placed: "dev" }
  }
  // release: immutable v<version>/, mutable latest/, and the same build
  // placed directly at the site root too. main.tsx renders the showcase hub
  // (TemplateLanding) at any URL with no recognized channel suffix — the
  // bare root included — so without this, a real scaffolded repo's own
  // https://owner.github.io/repo/ has nothing deployed there at all and
  // 404s instead of ever reaching that hub. Reusing the release dist here is
  // exactly like latest/ reusing it: the asset URLs it references (under
  // v<version>/assets/) already exist from the versionDir placement above,
  // so nothing 404s.
  cleanupForeignVersionsIfFirstRelease(siteDir, repo)
  const versionDir = join(siteDir, `v${version}`)
  replaceDir(versionDir, distDir)
  writeFileSync(
    join(versionDir, "showcase-meta.json"),
    JSON.stringify({ version, publishedAt: new Date().toISOString(), sha, repo }, null, 2) + "\n",
  )
  const latestDir = join(siteDir, "latest")
  replaceDir(latestDir, distDir)
  mkdirSync(siteDir, { recursive: true })
  cpSync(distDir, siteDir, { recursive: true })
  return { placed: `v${version}`, latest: "latest", root: true }
}

/**
 * Remove the mutable dev dir from the gh-pages tree (retire the dev URL when
 * the `dev` branch is deleted). Only ever touches `dev/` — never a versioned
 * release or `latest/`. No-op if absent.
 */
export function removeDevDir(siteDir) {
  const devDir = join(siteDir, "dev")
  if (!existsSync(devDir)) return { removed: false }
  rmSync(devDir, { recursive: true, force: true })
  return { removed: true, path: "dev" }
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim()
}

function sleep(ms) {
  // synchronous backoff (deploy step is not latency-sensitive)
  const end = Date.now() + ms
  while (Date.now() < end) {}
}

/** Regenerate versions.json (release runs only), then commit + push with rebase-retry. */
export function finalize({ siteDir, updateVersions, push, commitMessage, remoteBranch = "gh-pages", repo }) {
  if (updateVersions) {
    const versions = buildVersionsManifest(siteDir, repo)
    writeFileSync(join(siteDir, "versions.json"), JSON.stringify(versions, null, 2) + "\n")
  }
  git(["add", "-A"], siteDir)
  const status = git(["status", "--porcelain"], siteDir)
  if (!status) {
    console.log("deploy: nothing to commit (no-op)")
    return { committed: false }
  }
  git(["commit", "-m", commitMessage || "deploy: publish widget"], siteDir)
  if (!push) return { committed: true, pushed: false }

  let lastErr
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      git(["push", "origin", `HEAD:${remoteBranch}`], siteDir)
      return { committed: true, pushed: true, attempts: attempt }
    } catch (err) {
      lastErr = err
      console.warn(`deploy: push attempt ${attempt} failed, rebasing on origin/${remoteBranch}`)
      try {
        git(["fetch", "origin", remoteBranch], siteDir)
        git(["rebase", `origin/${remoteBranch}`], siteDir)
      } catch (rebaseErr) {
        git(["rebase", "--abort"], siteDir)
        throw rebaseErr
      }
      if (attempt < 4) sleep(2000 * 2 ** (attempt - 1)) // 2s,4s,8s
    }
  }
  throw lastErr
}

/**
 * Establish the schema every widget repo should start from -- `main` and
 * `dev` identical, `gh-pages` managed by CI only -- by pruning every other
 * branch and force-resetting `dev` to `main`'s current tip (the commit
 * already checked out at `repoDir`). Runs once, gated by the caller on
 * `plan()`'s `firstRelease` flag, so it applies equally to a CLI scaffold
 * (already satisfies this trivially -- nothing to prune, dev already equals
 * main) and a repo copied via GitHub's "Use this template" (may have a
 * stray inherited branch, or `dev` tracking the source template's own
 * unrelated preview history). Operates on `repoDir`, the repo's own
 * checkout -- a different directory than the gh-pages `siteDir` every other
 * function here works with.
 */
export function resetBranchesIfFirstRelease(repoDir, keep = ["main", "dev", "gh-pages"]) {
  const raw = git(["ls-remote", "--heads", "origin"], repoDir)
  const branches = raw
    ? raw.split("\n").map((line) => line.split("refs/heads/")[1]).filter(Boolean)
    : []
  const deletedBranches = []
  for (const b of branches) {
    if (keep.includes(b)) continue
    git(["push", "origin", "--delete", b], repoDir)
    deletedBranches.push(b)
  }
  git(["push", "--force", "origin", "HEAD:refs/heads/dev"], repoDir)
  return { deletedBranches, devReset: true }
}

// ----------------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("--")) out[key] = true
      else { out[key] = next; i++ }
    } else out._.push(a)
  }
  return out
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  const args = parseArgs(rest)

  switch (cmd) {
    case "plan": {
      const result = plan(args.site, args.repo, args.event, args.ref, { force: !!args.force })
      process.stdout.write(JSON.stringify(result))
      break
    }
    case "place": {
      const res = placeTarget({
        siteDir: args.site,
        channel: args.channel,
        version: args.version,
        distDir: args.dist,
        sha: args.sha,
        ref: args.ref,
        repo: args.repo,
      })
      console.log("placed:", JSON.stringify(res))
      break
    }
    case "remove": {
      const res = removeDevDir(args.site)
      console.log("remove:", JSON.stringify(res))
      break
    }
    case "finalize": {
      const res = finalize({
        siteDir: args.site,
        updateVersions: !!args["update-versions"],
        push: !!args.push,
        commitMessage: args["commit-message"],
        repo: args.repo,
      })
      console.log("finalize:", JSON.stringify(res))
      break
    }
    case "reset-branches": {
      const res = resetBranchesIfFirstRelease(args["repo-dir"] || ".")
      console.log("reset-branches:", JSON.stringify(res))
      break
    }
    default:
      console.error(`unknown subcommand: ${cmd || "(none)"}`)
      process.exit(2)
  }
}

// Only run the CLI when executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) main()
