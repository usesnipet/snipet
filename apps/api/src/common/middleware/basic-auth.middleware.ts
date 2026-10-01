import { createHash, timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

// Hashing first gives timingSafeEqual equal-length inputs.
const digest = (value: string) => createHash("sha256").update(value).digest();
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export function basicAuth(username: string, password: string, realm = "Restricted") {
  return (req: Request, res: Response, next: NextFunction) => {
    const [scheme, encoded] = req.headers.authorization?.split(" ") ?? [];
    if (scheme?.toLowerCase() === "basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      // Both compared always, so a wrong username takes as long as a wrong password.
      const userOk = safeEqual(decoded.slice(0, sep), username);
      const passOk = safeEqual(decoded.slice(sep + 1), password);
      if (sep !== -1 && userOk && passOk) return next();
    }
    res.setHeader("WWW-Authenticate", `Basic realm="${realm}", charset="UTF-8"`);
    res.status(401).send("Unauthorized");
  };
}
