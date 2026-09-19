#!/usr/bin/env bash
# update-upstream.sh — Fork sync: pull decolua/9router (upstream) into this repo.
#
# Strategy: MERGE, not rebase. This fork carries local-only commits (provider
# tweaks, CI publish, this limit/quota work). Rebasing would rewrite them and
# force-conflict on every sync; a merge keeps our history and upstream's
# as separate lines, resolving once per conflicting file.
#
# Works from a dirty tree too: all local changes are stashed before the merge
# and restored afterwards (the stash survives a failed merge).
#
# Usage:
#   ./scripts/update-upstream.sh            # sync + self-build check
#   ./scripts/update-upstream.sh --no-build # sync only
#   ./scripts/update-upstream.sh --abort    # revert a failed merge + restore stash

set -euo pipefail

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-origin}"
UPSTREAM_BRANCH="${UPSTREAM_BRANCH:-master}"
LOCAL_BRANCH="$(git branch --show-current)"

if [[ "$LOCAL_BRANCH" == "" ]]; then
  echo "error: detached HEAD — checkout a branch first (e.g. git checkout master)" >&2
  exit 1
fi

if [[ "${1:-}" == "--abort" ]]; then
  git merge --abort 2>/dev/null || true
  if git stash list | grep -q "9router-upstream:"; then
    git stash apply "stash@{$(git stash list | grep -n '9router-upstream:' | cut -d: -f1 | head -1)}"
    git stash drop "stash@{0}" 2>/dev/null || true
    echo "restored local changes from stash."
  else
    echo "no 9router-upstream stash found — nothing to restore."
  fi
  exit 0
fi

echo "==> fetching upstream ($UPSTREAM_REMOTE/$UPSTREAM_BRANCH)"
git fetch "$UPSTREAM_REMOTE" "$UPSTREAM_BRANCH"

MERGE_BASE="$(git merge-base HEAD "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH")"
if [[ "$(git rev-parse "$MERGE_BASE")" == "$(git rev-parse "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH")" ]]; then
  echo "==> upstream is already fully merged. nothing to do."
  exit 0
fi

# Dirty tree? stash with a recognizable label so --abort can find it later
if ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]; then
  echo "==> working tree is dirty — stashing local changes"
  git stash push -u -m "9router-upstream: pre-sync $(date +%Y-%m-%d_%H%M%S)"
fi

echo "==> merging $UPSTREAM_REMOTE/$UPSTREAM_BRANCH into $LOCAL_BRANCH"
if ! git merge "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" -m "merge: upstream $UPSTREAM_REMOTE/$UPSTREAM_BRANCH ($(git log -1 --format=%h "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"))"; then
  echo
  echo "!! merge conflicts. resolve them, then run:"
  echo "   git add <resolved-files> && git commit"
  echo "   ./scripts/update-upstream.sh --abort   # to bail out and restore your stash"
  exit 1
fi

# Restore stashed changes on top of the merged tree
if git stash list | grep -q "9router-upstream:"; then
  echo "==> restoring local changes"
  git stash pop
fi

echo "==> new commits from upstream: $(git log --oneline "$MERGE_BASE..$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" | wc -l)"

if [[ "${1:-}" != "--no-build" ]]; then
  echo "==> smoke-checking install + lint (skip with --no-build)"
  npm install --no-audit --no-fund >/dev/null 2>&1 || { echo "!! npm install failed — update still merged, check deps."; exit 2; }
  npx eslint src open-sse --max-warnings 0 2>/dev/null || echo "!! eslint reported issues — review before deploying."
fi

echo "==> done. review with: git log --oneline -10"