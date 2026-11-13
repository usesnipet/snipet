import "reflect-metadata";

import { PATH_METADATA } from "@nestjs/common/constants.js";
import z from "zod";

import { CrudController } from "./crud.controller.js";

/** The route path of `route` on a controller class, undefined when it isn't routed. */
const pathOf = (controller: abstract new (...args: never[]) => object, route: string) =>
  Reflect.getMetadata(
    PATH_METADATA,
    Object.getOwnPropertyDescriptor(controller.prototype, route)?.value as object,
  ) as unknown;

describe("CrudController", () => {
  it("leaves the routes in `except` out, keeping the rest", () => {
    const Base = CrudController({ update: z.object({}), except: ["create", "deleteById"] });
    expect(pathOf(Base, "create")).toBeUndefined();
    expect(pathOf(Base, "deleteById")).toBeUndefined();
    expect(pathOf(Base, "filter")).toBe("/");
    expect(pathOf(Base, "findById")).toBe(":id");
    // Each call builds its own methods: excluding here leaves other controllers' routes alone.
    expect(pathOf(CrudController({}), "create")).toBe("/");
  });
});
