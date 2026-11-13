import { sessionTitleOf } from "./session-title.js";

describe("sessionTitleOf", () => {
  it.each([
    ["# Title", "Title"],
    ["\n\n  oi\nsecond line", "oi"],
    ["- **bold** item", "bold item"],
    ["1. first `step`", "first step"],
    ["> quoted", "quoted"],
    ["what does issue_read do?", "what does issue_read do?"],
    ["   ", ""],
  ])("%j becomes %j", (input, title) => {
    expect(sessionTitleOf(input)).toBe(title);
  });

  it("caps the length", () => {
    expect(sessionTitleOf("x".repeat(200))).toHaveLength(80);
  });
});
