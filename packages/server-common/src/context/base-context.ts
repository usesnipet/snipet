import type { EntityManager } from "typeorm";

// Request-scoped data passed explicitly to services, like Go's `context`.
// Immutable: every change returns a new context. Subclasses add typed,
// readonly fields with their own `withX` (no #private: Object.assign skips them).
export abstract class BaseContext {
  // Set inside a transaction; CrudService.repository(ctx) uses it.
  readonly tx?: EntityManager;
  private values: ReadonlyMap<unknown, unknown> = new Map();

  withTx(tx: EntityManager): this {
    return this.with({ tx } as Partial<this>);
  }

  // Untyped values, for cases the typed fields don't cover. Use a Symbol per key.
  withValue(key: unknown, value: unknown): this {
    return this.with({ values: new Map(this.values).set(key, value) } as unknown as Partial<this>);
  }

  value<T = unknown>(key: unknown): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  // Copies this context (same subclass) with patch applied, frozen.
  protected with(patch: Partial<this>): this {
    return Object.freeze(Object.assign(Object.create(Object.getPrototypeOf(this) as object), this, patch)) as this;
  }
}
