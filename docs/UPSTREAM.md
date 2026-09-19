# Updating from upstream (9router)

This fork (`zcus0/9router-v2`) tracks [decolua/9router](https://github.com/decolua/9router).
Upstream ships the routing gateway + dashboard; this fork adds local-only work
(provider tweaks, publish CI, quota/limit features) that must survive every sync.

## Remote layout

```
origin  decolua/9router      (upstream — read-only)
fork    zcus0/9router        (original fork target)
zcus0   zcus0/9router-v2     (this repo's publish target)
```

`origin/master` is the upstream default branch. This repo's `master` = upstream +
local merge commits.

## Sync (recommended)

```bash
./scripts/update-upstream.sh
```

What it does:

1. `git fetch origin master`
2. No-op if upstream is already merged into HEAD.
3. **Stashes any uncommitted work** (including untracked files) so a dirty
   tree never blocks the sync.
4. `git merge origin/master` — merge, **not rebase** (see below).
5. Pops the stash back on top of the merged tree.
6. Smoke check: `npm install` + `eslint`.

Options:

- `--no-build` — skip the install/lint smoke check.
- `--abort` — after a conflicted merge: `git merge --abort`, restore the stash.

### When the merge conflicts

Upstream changed a file you also touched locally. Resolve normally:

```bash
git status                    # shows conflicted files
# edit each one, keep the local feature AND the upstream fix where both apply
git add <files>
git commit                    # completes the merge
```

or bail out entirely:

```bash
./scripts/update-upstream.sh --abort
```

## Why merge, not rebase

Rebasing rewrites this fork's local commits on top of upstream. Every sync then
replays the whole local chain, and any conflict aborts the entire rebase halfway.
Merge keeps two clean history lines and resolves each conflicting file once, at
the point it actually conflicts. History shows upstream merges explicitly:

```
*   merge: upstream origin/master (a8c9d38)
|\
| * a8c9d38 upstream fix ...
* | 0653a2f local publish CI ...
```

## Deploying a synced update

1. Commit or stash everything; confirm clean: `git status`.
2. Push to GitHub: `git push zcus0 master` (public mirror at `zcus0/9router-v2`).
3. The GitHub Action `docker-publish.yml` builds `zcus0/9router-v2:latest`
   (multi-arch) on tag `v*` push or manual `workflow_dispatch`.
4. On the VPS, via Dokploy: trigger a redeploy of the `9router-v2` service —
   it pulls `zcus0/9router-v2:latest` from Docker Hub (see `docker-compose.yml`).

> Note: the workflow is tag-triggered. For a plain `master` refresh, push a tag
> (`git tag vX.Y.Z && git push zcus0 vX.Y.Z`) or run the workflow manually from
> the Actions tab.

## Checklist after a sync

- `npm install` (new deps) — done by the script.
- Schema/db changes upstream: bump `SCHEMA_VERSION` in `src/lib/db/schema.js`
  (+1) if upstream altered tables, and verify `tests` still pass:
  `cd tests && npx vitest run`.
- If upstream changed `Dockerfile`/`docker-compose.yml`, re-verify the image
  still builds on your VPS before redeploying production.