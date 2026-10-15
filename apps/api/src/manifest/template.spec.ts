import { render } from "./template.js";

describe("render", () => {
  const vars = { connection: { apiKey: "k1", port: 8852 } };

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
      port: 8852,
      url: "http://h:8852",
    });
  });

  it("renders a missing variable as an empty string", () => {
    expect(render({ a: "{{connection.nope}}", b: "Bearer {{ connection.nope }}" }, vars)).toEqual({
      a: "",
      b: "Bearer ",
    });
  });

  it("uses the default when the variable is missing, null or empty", () => {
    const v = { connection: { apiKey: "k1", empty: "", nil: null } };
    expect(
      render(
        {
          missing: '{{ connection.nope || "d" }}',
          empty: '{{connection.empty||"d"}}',
          nil: 'x-{{ connection.nil || "d" }}',
          set: '{{ connection.apiKey || "d" }}',
          blank: '{{ connection.nope || "" }}',
        },
        v,
      ),
    ).toEqual({ missing: "d", empty: "d", nil: "x-d", set: "k1", blank: "" });
  });
});
