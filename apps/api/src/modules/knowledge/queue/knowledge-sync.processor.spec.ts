import { jest } from "@jest/globals";
import { KnowledgeItemStatus } from "@snipet/shared";

import { KnowledgeSyncProcessor } from "./knowledge-sync.processor.js";

import type { PgvectorService } from "../../../infra/pgvector/pgvector.service.js";
import type { KnowledgeItem } from "../knowledge-item.entity.js";
import type { KnowledgeSyncService } from "./knowledge-sync.service.js";
import type { S3Source, SourceObject } from "../../../infra/storage/s3-source.js";
import type { Repository } from "typeorm";

type Fn = (...args: unknown[]) => Promise<unknown>;

const object = (key: string, hash: string): SourceObject => ({ key, name: key, hash, size: 1, lastModified: null });

describe("KnowledgeSyncProcessor.process", () => {
  it("upserts new and changed objects as pending, deletes gone ones and queues pending items", async () => {
    const items = {
      find: jest.fn<Fn>().mockResolvedValue([
        { id: "same", externalId: "same.md", hash: "h1" },
        { id: "changed", externalId: "changed.md", hash: "old" },
        { id: "gone", externalId: "gone.md", hash: "h3" },
      ]),
      upsert: jest.fn<Fn>(),
      delete: jest.fn<Fn>(),
    };
    // for await also walks a plain array.
    const source = { list: () => [object("same.md", "h1"), object("changed.md", "new"), object("new.md", "h4")] };
    const pgvector = { deleteByItemIds: jest.fn<Fn>() };
    const syncService = { enqueueIndex: jest.fn<Fn>() };
    const processor = new KnowledgeSyncProcessor(
      items as unknown as Repository<KnowledgeItem>,
      source as unknown as S3Source,
      pgvector as unknown as PgvectorService,
      syncService as unknown as KnowledgeSyncService,
    );

    expect(await processor.process()).toEqual({ upserted: 2, deleted: 1 });

    const [upserted, conflict] = items.upsert.mock.calls[0] as [Partial<KnowledgeItem>[], string[]];
    expect(conflict).toEqual(["externalId"]);
    expect(upserted.map((i) => [i.externalId, i.hash, i.status])).toEqual([
      ["changed.md", "new", KnowledgeItemStatus.PENDING],
      ["new.md", "h4", KnowledgeItemStatus.PENDING],
    ]);
    expect(pgvector.deleteByItemIds).toHaveBeenCalledWith(["gone"]);
    expect(items.delete).toHaveBeenCalledWith(["gone"]);
    expect(syncService.enqueueIndex).toHaveBeenCalledWith(KnowledgeItemStatus.PENDING);
  });

  it("deletes nothing when listing the source fails", async () => {
    const items = {
      find: jest.fn<Fn>().mockResolvedValue([{ id: "a", externalId: "a.md", hash: "h" }]),
      upsert: jest.fn<Fn>(),
      delete: jest.fn<Fn>(),
    };
    const source = {
      list: () => {
        throw new Error("AccessDenied");
      },
    };
    const processor = new KnowledgeSyncProcessor(
      items as unknown as Repository<KnowledgeItem>,
      source as unknown as S3Source,
      { deleteByItemIds: jest.fn() } as unknown as PgvectorService,
      { enqueueIndex: jest.fn() } as unknown as KnowledgeSyncService,
    );

    await expect(processor.process()).rejects.toThrow("AccessDenied");
    expect(items.delete).not.toHaveBeenCalled();
  });
});
