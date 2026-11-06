/** Splits "llm-key/model" on the first "/", like the backend; a missing side reads as "". */
export function splitModelRef(ref: string): [llmKey: string, modelKey: string] {
  const i = ref.indexOf("/");
  if (i <= 0) return ["", ""];
  return [ref.slice(0, i), ref.slice(i + 1)];
}
