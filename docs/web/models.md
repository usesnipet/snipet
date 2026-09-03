# `src/models/`

The Zod schema for a feature's core entity — the shape with an `id` and
relations to other entities — lives in `src/models/<feature>.ts`, one file
per feature that has such an entity, not inside that feature's own
`schemas.ts`.

The skeleton ships no models (no domain features yet). The pattern:

```typescript
// src/models/post.ts
import { z } from "zod";

import { authorSchema } from "@/models/author";

export const postSchema = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(255),
    author_id: z.uuid(),
    author: authorSchema.nullable(),
  })
  .strict();
export type Post = z.infer<typeof postSchema>;
```

## Why this exists

Entities reference each other — a `Post` embeds an `Author`, a `Comment`
embeds a `Post`. If those schemas lived in each feature's `schemas.ts`,
one feature would have to import another feature's `schemas.ts` to build
the relation, and the reverse relation (when it's added later) would
create an import cycle between the two features. Pulling every entity into
its own file under `src/models/`, with no feature ever importing another
feature's `schemas.ts` for this purpose, keeps the dependency direction
one-way: `models/*` never imports from `features/*`, and any file may
import from `models/*`.

## What goes here vs. `features/<feature>/schemas.ts`

- **`models/<feature>.ts`**: the entity schema and any value objects
  nested inside it. Nothing else — no DTOs, no pagination wrappers, no
  search params.
- **`features/<feature>/schemas.ts`**: re-exports the entity from
  `@/models/<feature>` (so existing imports of `@/features/<feature>/schemas`
  keep working), then defines everything derived from it — create/update
  DTOs, `paginatedSchema(...)` wrappers, search params, response envelopes.
  See [features/schemas.md](./features/schemas.md).

```typescript
// features/post/schemas.ts
import { postSchema } from "@/models/post";

export { postSchema } from "@/models/post";
export type { Post } from "@/models/post";

export const createPostSchema = postSchema
  .pick({ title: true, author_id: true })
  .strict();
export type CreatePost = z.infer<typeof createPostSchema>;
```

A feature that needs another feature's entity imports it from
`@/models/<other>` directly — never from `@/features/<other>/schemas`.

## When to skip this

Not every feature has an entity. A feature whose schemas are pure
config/singleton shapes with no `id` and no relations to another entity
(e.g. `system`'s `systemInfoSchema`) has no reason to split — its schema
stays entirely in that feature's own `schemas.ts`.

## Relation to `src/schemas/`

`src/models/` and `src/schemas/` (see [schemas.md](./schemas.md)) are both
"lives outside one feature folder" but for different reasons: `src/schemas/`
holds generic, domain-agnostic shapes reused by shape (`paginatedSchema`) —
they don't represent an entity and don't participate in entity relations.
`src/models/` holds one specific feature's entity, pulled out only because
other entities reference it.
