import { jest } from "@jest/globals";
import { KnowledgeItemStatus } from "@snipet/shared";
import { setTimeout as sleep } from "node:timers/promises";

import { KnowledgeIndexerService } from "./knowledge-indexer.service.js";

import type { KnowledgeItem } from "../knowledge-item.entity.js";
import type { Repository } from "typeorm";

describe("KnowledgeIndexerService.wake", () => {
  it("claims and indexes every pending item once", async () => {
    const rows = ["a", "b", "c"].map((id) => ({ id, status: KnowledgeItemStatus.PENDING }));
    const items = {
      findOne: jest.fn(() => Promise.resolve(rows.find((r) => r.status === KnowledgeItemStatus.PENDING) ?? null)),
      update: jest.fn((where: { id: string; status: KnowledgeItemStatus }, set: { status: KnowledgeItemStatus }) => {
        const row = rows.find((r) => r.id === where.id && r.status === where.status);
        if (row) row.status = set.status;
        return Promise.resolve({ affected: row ? 1 : 0 });
      }),
    };
    const indexer = new KnowledgeIndexerService(items as unknown as Repository<KnowledgeItem>, null!, null!, null!);
    const indexed: string[] = [];
    jest.spyOn(indexer, "index").mockImplementation((item) => {
      indexed.push(item.id);
      return Promise.resolve();
    });

    indexer.wake();
    indexer.wake(); // no extra workers past the limit, no double claims
    await sleep(10);

    expect(indexed.sort()).toEqual(["a", "b", "c"]);
  });
});
