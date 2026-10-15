import { jest } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";
import { SECRET_PLACEHOLDER } from "@snipet/server-common";
import { pluginManifestSchema } from "@snipet/shared";
import { z } from "zod";

import { ConnectionService } from "./connection.service.js";
import { Driver } from "./driver.js";
import { DriverRegistry } from "./driver.registry.js";

import type { PluginManifest } from "@snipet/shared";
import type { QueryDeepPartialEntity, Repository } from "typeorm";
import type { ConnectionEntity } from "./connection.service.js";
import type { ManifestRegistry } from "./manifest.registry.js";

type Fn = (...args: unknown[]) => Promise<unknown>;

class Echo extends Driver(z.strictObject({ url: z.url(), token: z.string().optional() })) {
  readonly key = "echo";
}
type Drivers = { actions: Echo };

type Conn = ConnectionEntity & { pluginKey: string };

class TestService extends ConnectionService<Conn, PluginManifest, Drivers> {
  protected readonly keyField = "pluginKey";
}

const manifest = (key: string) =>
  pluginManifestSchema.parse({
    key,
    name: key,
    connection: {
      type: "object",
      properties: { url: { type: "string" }, token: { type: "string", secret: true }, retries: { default: 3 } },
      required: ["url"],
    },
    actions: { driver: "echo", options: { url: "{{ connection.url }}", token: "{{ connection.token }}" } },
  });

const stored: Conn = {
  id: "c1",
  pluginKey: "alpha",
  config: { url: "https://a.dev", token: "tk-1", retries: 3 },
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setup() {
  const repo = {
    findOneBy: jest.fn<Fn>().mockResolvedValue(stored),
    update: jest.fn<Fn>().mockResolvedValue({ affected: 1 }),
    create: jest.fn((dto: unknown) => dto),
    save: jest.fn<Fn>().mockImplementation((e) => Promise.resolve(e)),
    metadata: { name: "Conn" },
  };
  const manifests = { get: (key: string) => manifest(key), getAll: () => [manifest("alpha")] };
  const service = new TestService(
    repo as unknown as Repository<Conn>,
    manifests as unknown as ManifestRegistry<PluginManifest, Drivers>,
    new DriverRegistry<Drivers>({ actions: [new Echo()] }),
  );
  return { service, repo };
}

describe("ConnectionService.validateConfig", () => {
  it("applies the connection schema defaults", () => {
    const { service } = setup();
    expect(service.validateConfig("alpha", { url: "https://a.dev" })).toEqual({ url: "https://a.dev", retries: 3 });
  });

  it("rejects a config that breaks the connection schema", () => {
    const { service } = setup();
    expect(() => service.validateConfig("alpha", {})).toThrow(BadRequestException);
  });

  it("rejects a config whose rendered driver options are invalid", () => {
    const { service } = setup();
    expect(() => service.validateConfig("alpha", { url: "not a url" })).toThrow("invalid options");
  });
});

describe("ConnectionService.create", () => {
  it("saves the validated config", async () => {
    const { service, repo } = setup();
    await service.create({ pluginKey: "alpha", config: { url: "https://a.dev" } });
    expect(repo.save).toHaveBeenCalledWith({ pluginKey: "alpha", config: { url: "https://a.dev", retries: 3 } });
  });
});

describe("ConnectionService.updateById", () => {
  it("leaves the dto alone when neither key nor config change", async () => {
    const { service, repo } = setup();
    await service.updateById("c1", { enabled: true } as never);
    expect(repo.update).toHaveBeenCalledWith("c1", { enabled: true });
    expect(repo.findOneBy).not.toHaveBeenCalled();
  });

  it("keeps the stored secret for a placeholder", async () => {
    const { service, repo } = setup();
    const dto = { config: { url: "https://b.dev", token: SECRET_PLACEHOLDER } } as QueryDeepPartialEntity<Conn>;
    await service.updateById("c1", dto);
    expect(repo.update).toHaveBeenCalledWith("c1", { config: { url: "https://b.dev", token: "tk-1", retries: 3 } });
  });

  it("never hands the stored secret to another manifest", async () => {
    const { service, repo } = setup();
    await service.updateById("c1", { pluginKey: "beta", config: { url: "https://b.dev", token: SECRET_PLACEHOLDER } });
    expect(repo.update).toHaveBeenCalledWith("c1", {
      pluginKey: "beta",
      config: { url: "https://b.dev", retries: 3 },
    });
  });

  it("revalidates the stored config when only the key changes", async () => {
    const { service, repo } = setup();
    await service.updateById("c1", { pluginKey: "beta" });
    expect(repo.update).toHaveBeenCalledWith("c1", { pluginKey: "beta", config: { url: "https://a.dev", retries: 3 } });
  });
});

describe("ConnectionService.mask", () => {
  it("replaces secret fields with the placeholder", () => {
    const { service } = setup();
    expect(service.mask(stored).config).toEqual({ url: "https://a.dev", token: SECRET_PLACEHOLDER, retries: 3 });
  });
});

describe("ConnectionService manifests", () => {
  it("lists and gets manifests", () => {
    const { service } = setup();
    expect(service.listManifests().map((m) => m.key)).toEqual(["alpha"]);
    expect(service.getManifest("beta").key).toBe("beta");
  });
});
