---
name: repo-standards
description: Naming standards for code in this project - class properties and injected dependencies (repositories, services, registries, dispatchers), local variables, parameters, methods, functions and types. Use whenever writing or editing code, especially a class with a constructor that injects dependencies, even if the task never mentions naming. Also use when asked about project patterns, conventions, or naming.
---

# Naming standards

## Name things after what they are

A name should say what it holds or does, so the line that uses it reads correctly
without jumping back to the declaration. Properties, locals, parameters, methods and
types alike.

Descriptive is not long. Take the shortest name that still answers "what is this?"
where it's read, usually two or three words. A name needing a comment is too short;
one repeating its own type or its class is too long.

## Properties

Say what kind of thing it holds, so `this.x.find()` reads right without opening the
constructor. A plural like `users` reads as a list but is often a repository; a bare
`mail` could be a client, a message or a config.

| Before                       | After                                                    |
| ---------------------------- | -------------------------------------------------------- |
| `users: Repository<User>`    | `usersRepo` (whichever suffix the codebase already uses) |
| `mail: MailSenderService`    | `mailSenderService` (class name in camelCase)            |
| `drivers: DriverRegistry<D>` | `driverRegistry`                                         |
| `client: Redis`              | `redisClient`                                            |

Drop a prefix, not the kind. `connectionService` is fine where one connection exists,
wrong in a class holding two. No invented abbreviations (`mailSndSvc`).

Keep the name when it already states the kind (`logger`, `cache`, `config`), when it's
plain data (`users: User[]`), when a base class or framework fixes it, or when it's
outside the class (entity columns, DTO and API fields — renaming those breaks
migrations or clients).

## Locals, parameters, methods, types

- **Locals:** say what makes a derived value different from its source, don't restate
  the type: `recentOrders` not `recent`, `response` not `res`, `(event)` not `(e)`. A
  loop or one-line callback argument can stay short.
- **Booleans:** a claim about the subject: `isCancelled`, `hasResult`, `shouldRetry`.
- **Methods:** a verb phrase that doesn't repeat the class: `queue.push()`, not
  `queue.pushToQueue()`. Match the verb to the return (`get`/`find`, `build`/`create`,
  `ensure`/`sync`, `is`/`has`). A name needing "And" is two methods.
- **Types:** the concept, no `I` prefix or `Type` suffix. A type parameter for a domain
  thing gets a word (`K extends EventName`), not a letter.

## Fix names in the files you touch

Rename as part of the change you're already making: the class's properties, the
same-named parameters, the locals inside the functions you edit. No project-wide
cleanup — don't open a file only to rename, don't rename what you only read past.

A rename reaches past the file: public and `protected` members have callers, and tests
may reach private fields through casts or strings (`service['users']`), which the
compiler can't catch. Typecheck afterwards (`tsc --noEmit` for a TypeScript package).
