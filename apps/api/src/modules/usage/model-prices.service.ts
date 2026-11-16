import { env } from "#src/env.js";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { readFile, rename, writeFile } from "node:fs/promises";

import { findModelPrice, indexModelPrices } from "./model-prices.js";

import type { ModelPrice } from "./model-prices.js";

/** How long the download of the price list may take; it is a few MB. */
const DOWNLOAD_TIMEOUT_MS = 60_000;

/**
 * Model prices from LiteLLM's list. Reads the copy in the repo on boot, so prices work
 * offline, then replaces it with the latest one on boot and every midnight.
 */
@Injectable()
export class ModelPricesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ModelPricesService.name);
  private prices = new Map<string, ModelPrice>();

  async onApplicationBootstrap(): Promise<void> {
    try {
      this.prices = indexModelPrices(JSON.parse(await readFile(env.MODEL_PRICES_FILE, "utf8")));
    } catch (err) {
      this.logger.warn(`read model prices ${env.MODEL_PRICES_FILE}: ${String(err)}`);
    }
    // In the background: a slow or unreachable GitHub must not hold the boot.
    void this.refresh();
  }

  /** The model's prices, undefined when the list doesn't have it. */
  find(model: string): ModelPrice | undefined {
    return findModelPrice(this.prices, model);
  }

  /** Downloads the latest list and swaps it in, file included; on any failure the current one stays. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async refresh(): Promise<void> {
    try {
      const response = await fetch(env.MODEL_PRICES_URL, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      // Indexed before writing, so a broken download never replaces the file.
      const prices = indexModelPrices(JSON.parse(text));
      if (prices.size === 0) throw new Error("no model has a price");

      this.prices = prices;
      this.logger.log(`model prices updated: ${prices.size} models`);
      await this.save(text);
    } catch (err) {
      this.logger.warn(`update model prices from ${env.MODEL_PRICES_URL}: ${String(err)}`);
    }
  }

  /**
   * Replaces the copy on disk, for the next boot. Apart from the swap: in a read-only
   * install (the Docker image runs as a user that can't write /app) the prices still update.
   */
  private async save(text: string): Promise<void> {
    // Written aside and renamed, so a crash mid-write leaves the old file whole.
    const tempFile = `${env.MODEL_PRICES_FILE}.tmp`;
    try {
      await writeFile(tempFile, text);
      await rename(tempFile, env.MODEL_PRICES_FILE);
    } catch (err) {
      this.logger.warn(`save model prices to ${env.MODEL_PRICES_FILE}: ${String(err)}`);
    }
  }
}
