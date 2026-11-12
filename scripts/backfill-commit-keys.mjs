// Applies the #114 commit rule (decision 004) to commits stored before it:
// prints SQL that deletes GitHub's own commits on the default branch, deletes
// all but the earliest copy of each commit, and fills in `commit_key`.
//
// It never connects to a database. It reads the stored SHAs on stdin, looks
// each one up in this clone's git history (or with `gh api` when the clone
// doesn't have it), and writes one transaction to stdout for you to review.
//
// Usage (from the repo root, Node 22.18 or later for the .ts import; the flag
// hides Node's notice that it reparsed commit-key.ts as a module):
//   git fetch origin --prune
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/backfill-commit-keys.mjs \
//     --repo owner/name [--default-branch origin/main] < commit-shas.txt > backfill.sql
//
// Running the SQL again changes nothing. The PR for #114 lists the export and
// apply commands.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { toCommitKey } from "../src/lib/github/commit-key.ts";

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
// How git records a commit GitHub made (committer `web-flow` in the payload).
const GITHUB_COMMITTER = { name: "GitHub", email: "noreply@github.com" };
const FIELD = "\x1f";

const { values } = parseArgs({
  options: {
    repo: { type: "string" },
    "default-branch": { type: "string", default: "origin/main" },
  },
});
if (!values.repo || !REPO_PATTERN.test(values.repo)) {
  throw new Error("Pass --repo owner/name, as the team's repository.");
}

function git(args, input) {
  return execFileSync("git", args, {
    input,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
}

function readShas() {
  const lines = readFileSync(0, "utf8").split("\n");
  const shas = new Set();
  for (const line of lines.map((text) => text.trim()).filter(Boolean)) {
    if (SHA_PATTERN.test(line)) {
      shas.add(line);
    } else {
      process.stderr.write(`Skipped "${line}": not a full commit SHA.\n`);
    }
  }
  return [...shas];
}

// "Made on the default branch" is the first-parent history: merge commits,
// rebase and squash merges land there; a PR merged into another branch doesn't.
function readFirstParentShas(branch) {
  return new Set(git(["rev-list", "--first-parent", branch]).split("\n"));
}

function readLocalCommits(shas) {
  const present = git(["cat-file", "--batch-check=%(objectname) %(objecttype)"], shas.join("\n"))
    .split("\n")
    .filter((line) => line.endsWith(" commit"))
    .map((line) => line.split(" ")[0]);
  if (present.length === 0) {
    return new Map();
  }
  const format = ["%H", "%an", "%ae", "%aI", "%cn", "%ce", "%B"].join(FIELD);
  const output = git(
    ["log", "--no-walk=unsorted", "--stdin", "-z", `--format=${format}`],
    present.join("\n")
  );
  const commits = new Map();
  for (const record of output.split("\0").filter(Boolean)) {
    const [sha, name, email, date, committerName, committerEmail, ...rest] =
      record.split(FIELD);
    commits.set(sha, {
      authorName: name,
      authorEmail: email,
      authorDate: new Date(date),
      message: rest.join(FIELD),
      isGithubCommit:
        committerName === GITHUB_COMMITTER.name &&
        committerEmail === GITHUB_COMMITTER.email,
    });
  }
  return commits;
}

// A commit rebased away and deleted from every branch is gone from the clone,
// but GitHub still serves it by SHA.
function readRemoteCommit(sha) {
  try {
    const commit = JSON.parse(
      execFileSync("gh", ["api", `repos/${values.repo}/commits/${sha}`], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      })
    );
    return {
      authorName: commit.commit.author.name,
      authorEmail: commit.commit.author.email,
      authorDate: new Date(commit.commit.author.date),
      message: commit.commit.message,
      isGithubCommit: commit.committer?.login === "web-flow",
    };
  } catch {
    return null;
  }
}

function toSql(facts) {
  const scope = `a.team_id IN (SELECT id FROM teams WHERE lower(repo_full_name) = lower('${values.repo}')) AND a.type = 'COMMIT'`;
  const rows = facts
    .map(
      ({ sha, commitKey, isGithubOnDefaultBranch }) =>
        `  ('${sha}', '${commitKey}', ${isGithubOnDefaultBranch})`
    )
    .join(",\n");
  return `-- From scripts/backfill-commit-keys.mjs for ${values.repo} (#114, decision 004).
BEGIN;

CREATE TEMP TABLE commit_facts (
  sha text PRIMARY KEY,
  commit_key text NOT NULL,
  is_github_on_default_branch boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO commit_facts (sha, commit_key, is_github_on_default_branch) VALUES
${rows};

-- 1. Commits GitHub made on the default branch don't count.
DELETE FROM activities a USING commit_facts f
WHERE ${scope} AND a.sha = f.sha AND f.is_github_on_default_branch;

-- 2. Copies of one commit (same author, author date and message): keep the
-- earliest committed, as the webhook now does.
DELETE FROM activities a USING (
  SELECT a.id, row_number() OVER (
    PARTITION BY a.team_id, coalesce(a.commit_key, f.commit_key)
    ORDER BY a.occurred_at, a.sha
  ) AS copy_number
  FROM activities a LEFT JOIN commit_facts f ON f.sha = a.sha
  WHERE ${scope} AND coalesce(a.commit_key, f.commit_key) IS NOT NULL
) copies
WHERE a.id = copies.id AND copies.copy_number > 1;

-- 3. Fill in the keys, so a later copy of these commits isn't stored.
UPDATE activities a SET commit_key = f.commit_key FROM commit_facts f
WHERE ${scope} AND a.sha = f.sha AND a.commit_key IS NULL;

COMMIT;
`;
}

const shas = readShas();
const firstParent = readFirstParentShas(values["default-branch"]);
const local = readLocalCommits(shas);
const facts = [];
const missing = [];
for (const sha of shas) {
  const commit = local.get(sha) ?? readRemoteCommit(sha);
  if (commit === null) {
    missing.push(sha);
    continue;
  }
  facts.push({
    sha,
    commitKey: toCommitKey(commit),
    isGithubOnDefaultBranch: commit.isGithubCommit && firstParent.has(sha),
  });
}

const githubCount = facts.filter((fact) => fact.isGithubOnDefaultBranch).length;
process.stderr.write(
  `${facts.length} commits found (${githubCount} made by GitHub on ${values["default-branch"]}), ${missing.length} not found.\n`
);
for (const sha of missing) {
  process.stderr.write(`Not found, left as is: ${sha}\n`);
}
if (facts.length > 0) {
  process.stdout.write(toSql(facts));
}
