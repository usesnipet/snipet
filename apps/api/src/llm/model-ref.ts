import { LlmError } from "./errors.js";

/** Splits "llm/model" on the first "/", so a model key may contain "/". */
export function splitModelRef(ref: string): [llmKey: string, model: string] {
  const i = ref.indexOf("/");
  if (i <= 0 || i === ref.length - 1) throw new LlmError("bad_request", `bad model ref "${ref}"`);
  return [ref.slice(0, i), ref.slice(i + 1)];
}
