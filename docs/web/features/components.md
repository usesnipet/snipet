# `components/` (optional)

UI that's tightly coupled to this feature: it renders this feature's data,
calls this feature's hooks, or needs this feature's store. If two features
would end up wanting the same component, it doesn't belong here — move it
to `src/components/` instead (see [../components.md](../components.md)).

## What lives here

Looking at existing features (`foo`, `api-key`, `chat`), the recurring
shapes are:

- **Form dialogs**, one file per action:
  `create-<feature>-dialog.tsx`, `update-<feature>-dialog.tsx`. Each is a
  `DialogInstanceProps`-shaped component (see [../lib.md](../lib.md#dialog))
  that calls the matching `hooks.ts` mutation and closes itself via the
  injected `close()` prop on success.
- **No per-feature delete/confirm dialogs.** Actions that only need a
  yes/no (delete, roll a key, ...) open the generic `DeleteDialog`,
  `ConfirmDialog` or `ConfirmPromptDialog` from `@/components/confirm-dialog`
  (see [../components.md](../components.md#top-level-files)). The opener
  calls the mutation hook and passes it as `onConfirm`:

  ```tsx
  const { mutateAsync: deleteUser } = useDeleteUser();

  const openDelete = () => openDialog({
    component: DeleteDialog,
    props: {
      title: "Delete user?",
      description: <>This will permanently delete <span className="font-medium text-foreground">{user.name}</span>.</>,
      onConfirm: () => deleteUser(user.id),
    },
  });
  ```
- **A table/list**, `<feature>-table.tsx`, driving `useList<Feature>` from
  `hooks.ts` and rendering rows with per-row actions that open the dialogs above.
- **Form fields**, `<feature>-form-fields.tsx`, shared between the create
  and update dialogs when they use the same react-hook-form fields (see
  `components/form` in [../components.md](../components.md)).
- **Guards**, `<feature>-guard.tsx`, when the feature is what an area of
  the app is gated on (`<feature>-guard.tsx` — see
  [../routes.md](../routes.md)). A guard lives with the feature that owns
  the auth check, not under `routes/`, because it reads that feature's
  store/hooks directly.

## Imports

- Import this feature's own `hooks`/`schemas`/`store` with relative paths
  (`../hooks`, `../store`).
- Import generic, reusable pieces from `@/components` (`Button`, `Dialog`,
  `Page`, `SchemaFormDialog`, `FormInput`, ...) — don't reimplement design
  system primitives inside a feature.
- Don't import another feature's `components/` — if the UI is generic
  enough to be needed elsewhere, it should move to `@/components` instead.
