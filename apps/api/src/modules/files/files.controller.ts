import { Public } from "#src/common/decorators/auth.decorator.js";
import { Storage } from "#src/infra/storage/storage.js";
import { assertKey } from "#src/infra/storage/utils.js";
import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { extname } from "node:path";
import { pipeline } from "node:stream/promises";

import type { Response } from "express";
// Public so <img> tags can load them; keys are random UUIDs.
@Public()
@Controller("files")
export class FilesController {
  constructor(private readonly storage: Storage) {}

  @Get("*key")
  async get(@Param("key") segments: string[], @Res() res: Response) {
    const key = segments.join("/");
    assertKey(key);
    const file = await this.storage.get(key);
    if (!file) throw new NotFoundException("File not found");
    res.type(file.contentType ?? extname(key));
    // Every upload gets a new key, so a key's content never changes.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    await pipeline(file.body, res);
  }
}
