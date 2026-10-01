import { jest } from "@jest/globals";

import { basicAuth } from "./basic-auth.middleware.js";

import type { Request, Response } from "express";

function run(authorization?: string) {
  const res = {
    statusCode: 200,
    setHeader: jest.fn(),
    send: jest.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };
  const next = jest.fn();
  basicAuth("admin", "s3cr:et")({ headers: { authorization } } as Request, res as unknown as Response, next);
  return { next, res };
}

const header = (credentials: string) => `Basic ${Buffer.from(credentials).toString("base64")}`;

describe("basicAuth", () => {
  it("passes valid credentials, including a colon in the password", () => {
    expect(run(header("admin:s3cr:et")).next).toHaveBeenCalled();
  });

  it.each([undefined, "Bearer x", header("admin:wrong"), header("root:s3cr:et"), header("admins3cr:et")])(
    "rejects %s",
    (authorization) => {
      const { next, res } = run(authorization);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.setHeader).toHaveBeenCalledWith("WWW-Authenticate", expect.stringContaining("Basic"));
    },
  );
});
