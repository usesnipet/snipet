import { render } from "./template.js";

describe("render", () => {
  const vars = { connection: { apiKey: "k1", port: 8080 } };

  it("fills placeholders in nested values but never in keys", () => {
    expect(
      render(
        { headers: { "{{connection.apiKey}}": "Bearer {{ connection.apiKey }}" }, list: ["{{connection.apiKey}}"] },
        vars,
      ),
    ).toEqual({ headers: { "{{connection.apiKey}}": "Bearer k1" }, list: ["k1"] });
  });

  it("keeps the variable type when the string is a single placeholder", () => {
    expect(render({ port: "{{connection.port}}", url: "http://h:{{connection.port}}" }, vars)).toEqual({
      port: 8080,
      url: "http://h:8080",
    });
  });

  it("throws on a missing variable", () => {
    expect(() => render("{{connection.nope}}", vars)).toThrow('template variable "connection.nope" is not set');
  });
});
