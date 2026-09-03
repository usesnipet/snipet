---
name: update-docs
description: Keep docs/web/ and docs/backend/ in sync with the project's structure/conventions. Use PROACTIVELY after any change that adds, removes, or changes a structural pattern — a new feature layer, a new module component, a new middleware/auth mechanism, a new top-level folder under web/src or internal/, a renamed/moved layer, or a changed convention (e.g. a new DTO shape, a new required file in a feature/module). Also invoke when the user explicitly asks to update/sync the docs.
---

# Update docs

`docs/web/` and `docs/backend/` document **patterns and conventions**, not
the current state of the code — see each folder's `README.md`. That
distinction decides whether a change needs a doc update at all:

- **Needs a doc update:** the change introduces, removes, or changes a
  *pattern* — a new kind of layer/file a feature or module can have, a new
  middleware/auth mechanism, a renamed folder that a doc points at, a
  changed convention (new required DTO shape, new naming rule, new required
  step in a workflow like migrations).
- **Does NOT need a doc update:** the change is just another instance of an
  existing pattern — a new feature that only uses `schemas.ts`/`service.ts`/
  `hooks.ts` the normal way, a new backend module that follows the standard
  dto/service/handler shape, a new migration, a new route page. These are
  exactly what the docs already describe as the pattern.

When in doubt, ask: "if someone reads the relevant doc today, would they be
misled or missing something about how to do this?" If yes, update it. If
the doc's existing description still holds, don't touch it just because
something changed.

## 1. Figure out what changed

Diff the relevant surface (uncommitted changes, or a commit range the user
points at):

```bash
git status
git diff [--staged] [<base>...HEAD]
```

Classify each changed path: is it under `web/src/` or the Go backend
(`internal/`, `pkg/`, `cmd/`, `config/`, `migrations/`)? Is it a new file,
a moved/renamed file, a new folder, or a change to an existing file's
shape/contract?

## 2. Find the doc(s) that cover it

Don't hardcode a map — the docs' own index is the source of truth and can
change. Read the relevant root doc's table first:

- Frontend change → [`docs/web/README.md`](../../../docs/web/README.md)'s
  "Folder map" table, and if it's a feature-layer change,
  [`docs/web/features/README.md`](../../../docs/web/features/README.md)'s
  layer list.
- Backend change → [`docs/backend/README.md`](../../../docs/backend/README.md)'s
  "Docs" table.

Match the changed path against the table to find the owning doc(s). A
change can touch more than one doc (e.g. a new auth mechanism touches
`auth-middleware.md` and `bootstrap.md`'s wiring-snipet list).

If nothing in the table covers the changed path, that's itself a signal:
either it's a new top-level concern that needs a new doc (rare — confirm
with the user before adding one), or it's implementation detail the docs
correctly don't cover (in which case, do nothing).

## 3. Update the doc

Read the current doc fully before editing — every doc in this project
follows the same shape and you need to match it:

- Prose explains **why** a pattern exists and **when** to use it, not just
  what the code does.
- Real, verbatim-trimmed code snippets from the actual source illustrate
  the pattern — pull the current version of the snippet from the file you
  just changed rather than hand-editing the old one in place.
- Cross-links to sibling docs use relative markdown links
  (`[text](./other.md)`, `[text](../other.md)`), matching the existing
  link style in that doc.
- No mention of the current task, a ticket, or "recently added" — docs
  describe the pattern as it stands, not its history.

Concretely:

- **New pattern/layer added** (e.g. a feature gets a new kind of file the
  docs don't mention, a module gains a new required step): add a section
  or extend an existing one, following the doc's existing structure
  (heading level, snippet style).
- **Pattern changed** (e.g. a DTO convention changed, a middleware's
  signature changed): update the snippet and surrounding prose in place —
  don't leave the old version as a "before" example unless the doc is
  explicitly contrasting old vs. new.
- **Pattern removed**: delete the section; check other docs for links or
  references to it (`grep -rn` the removed term across `docs/`) and fix or
  remove those too.
- **Folder/file renamed or moved**: update every path mentioned across
  `docs/web/` and `docs/backend/` — `grep -rn '<old-path>' docs/` to find
  every reference, not just the obvious doc.
- **New top-level doc needed**: only when a genuinely new structural
  concern was added that doesn't fit any existing doc (new top-level
  folder under `web/src/` or `internal/`, a new plugin system). Confirm the
  scope with the user first — see how `docs/web/` and `docs/backend/`'s
  structures were confirmed via `AskUserQuestion` before being written, in
  this same conversation history if available. Add the new file to the
  owning `README.md`'s index table too.

## 4. Verify

- `grep -rn '<old-name-or-path>' docs/` returns nothing stale after a
  rename.
- Every doc you touched still reads coherently top to bottom — a partial
  edit that leaves a snippet and its prose disagreeing is worse than no
  edit.
- If a change spans both `docs/web/` and `docs/backend/` (rare — most
  changes are one side), update both before finishing.

## 5. Report

Summarize which doc file(s) changed and why, in one or two lines per file —
not a full diff dump. If you decided a change needed *no* doc update,
say so and why (usually: "just another instance of an existing pattern").
