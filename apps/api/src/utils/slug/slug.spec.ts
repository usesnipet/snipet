import { slugify } from "./slug.js";

describe("slugify", () => {
  it("strips accents and joins words with dashes", () => {
    expect(slugify("Suporte Técnico!")).toBe("suporte-tecnico");
  });

  it("cuts at maxLength without a trailing dash", () => {
    expect(slugify("abc def", 4)).toBe("abc");
  });

  it("is empty when nothing is left", () => {
    expect(slugify("¿?")).toBe("");
  });
});
