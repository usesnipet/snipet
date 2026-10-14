import { isGranted } from "./grant.js";

describe("isGranted", () => {
  it("grants everything when allow and deny are empty or missing", () => {
    expect(isGranted("read_file", {})).toBe(true);
    expect(isGranted("read_file", { allow: [], deny: [] })).toBe(true);
  });

  it("grants only names matching allow", () => {
    expect(isGranted("read_file", { allow: ["read_*"] })).toBe(true);
    expect(isGranted("write_file", { allow: ["read_*"] })).toBe(false);
    expect(isGranted("write_file", { allow: ["read_*", "write_file"] })).toBe(true);
  });

  it("lets deny win over allow", () => {
    expect(isGranted("read_file", { allow: ["read_*"], deny: ["*file"] })).toBe(false);
    expect(isGranted("read_file", { allow: [], deny: ["read_file"] })).toBe(false);
    expect(isGranted("read_dir", { allow: [], deny: ["read_file"] })).toBe(true);
  });

  it("applies deny when allow is missing", () => {
    expect(isGranted("read_file", { deny: ["read_*"] })).toBe(false);
    expect(isGranted("write_file", { deny: ["read_*"] })).toBe(true);
  });

  it("matches the whole name and treats only * as special", () => {
    expect(isGranted("a.b", { allow: ["a.*"] })).toBe(true);
    expect(isGranted("axb", { allow: ["a.b"] })).toBe(false);
    expect(isGranted("x_read_file", { allow: ["read_*"] })).toBe(false);
    expect(isGranted("a(b)+?", { allow: ["a(b)+?"] })).toBe(true);
    expect(isGranted("anything", { allow: ["*"] })).toBe(true);
  });
});
