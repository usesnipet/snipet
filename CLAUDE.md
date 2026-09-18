# Repo conventions

## Comments

A comment describes **what the code does** or **what it's for** — never
the edit history. Don't explain what you just changed or why you changed
it; that belongs in the commit message, not the file.

- Keep it short. One line beats a paragraph.
- Add an example only when the behavior is genuinely non-obvious.
- Skip comments that just restate the code.

```go
// BAD — narrates the diff, not the code
// Changed this to also check the role, since admin-only was wrong before.
func requireRole(ctx context.Context) error { ... }

// GOOD — says what it does
// requireRole rejects the request unless the caller's role is admin.
func requireRole(ctx context.Context) error { ... }
```

Don't over-comment. Not every function needs one — reserve them for
something a reader can't get from the name/signature alone.
