---
name: repo-standards
description: Coding standards for this repository, starting with how to name class properties and injected dependencies (repositories, services, registries, dispatchers). Use whenever writing or editing a class in this repo, especially a NestJS service, controller, runner, guard, or anything with a constructor that injects dependencies, even if the task never mentions naming. Also use when asked about repo patterns, conventions, or naming.
---

# Repository standards

## Name properties after what they are

A property's name should say what kind of thing it holds, so `this.x.find()` reads
correctly without jumping to the constructor. `this.runs` looks like a list of runs
but is a repository. `this.llm` could be a client, a model, or a config. In
`AgentRunner`, `hooks` is a `HookDispatcher` on the class and a `HookRunner` in the
method parameters, so the same word means two different types in one file.

| Kind                   | Pattern                 | Example                                      |
| ---------------------- | ----------------------- | -------------------------------------------- |
| TypeORM repository     | plural entity + `Repo`  | `runsRepo: Repository<AgentRun>`             |
| Service                | class name in camelCase | `llmConnectionService: LlmConnectionService` |
| Any other collaborator | class name in camelCase | `hookDispatcher: HookDispatcher`             |

The `Repo` pattern already exists in the code (`runsRepo`, `messagesRepo`,
`sessionsRepo`), so follow it instead of `runRepo` or `runRepository`.

Shorter names are fine if the kind stays visible and the name stays unambiguous in
that file. Drop a prefix, not the kind:

- `connectionService` works inside the LLM connection module.
- `connectionService` does not work in `AgentRunner`, where it could mean the LLM or
  the plugin connection service.
- Avoid invented abbreviations such as `llmConnSvc`; they save nothing and have to be
  decoded.

### Before and after

| Before                             | After                     |
| ---------------------------------- | ------------------------- |
| `runs: Repository<AgentRun>`       | `runsRepo`                |
| `repo: Repository<Setting>`        | `settingsRepo`            |
| `llm: LlmConnectionService`        | `llmConnectionService`    |
| `plugins: PluginConnectionService` | `pluginConnectionService` |
| `service: AuthService`             | `authService`             |
| `users: UserService`               | `userService`             |
| `jwt: JwtService`                  | `jwtService`              |
| `hooks: HookDispatcher`            | `hookDispatcher`          |
| `hooks: HookRunner` (parameter)    | `hookRunner`              |
| `events: AgentRunEvents`           | `runEvents`               |
| `drivers: DriverRegistry<D>`       | `driverRegistry`          |
| `syncer: LlmConnectionSyncService` | `connectionSyncService`   |
| `client: Redis`                    | `redisClient`             |

### What keeps its name

- **Names that already state the kind:** `logger`, `reflector`, `cache`, `agentContext`.
- **Plain data:** `runs: AgentRun[]` is right. Plural nouns belong to actual
  collections, which is why a repository shouldn't take one.
- **Names a base class fixes:** `override readonly service` in controllers that extend
  `CrudController`.
- **Names outside the class:** entity columns, DTO and API fields. Changing these
  breaks migrations or clients, so they aren't part of this rule.

## Fix names in the files you touch

New code follows the rule from the start. When a task has you editing a class that has
non-descriptive names, rename its properties as part of that change, along with the
same-named parameters in that class.

There's no repo-wide cleanup: don't open files only to rename things in them. The
codebase converges as files get edited, which keeps diffs tied to real work.

A rename can reach past the file you're in:

- `protected` and public properties are used by subclasses and callers, so update those too.
- Specs may reach private fields through casts or strings (`service['runs']`), which
  the compiler can't catch, so search the matching `*.spec.ts`.

Typecheck afterwards. In the API, that's `pnpm --filter @snipet/api exec tsc --noEmit`.
