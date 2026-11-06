const TITLE_LENGTH = 80;

/** A chat's title: the first line with text, without the Markdown marks that would show literally in a list. */
export function sessionTitleOf(input: string): string {
  const firstLine = input
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return (firstLine ?? "")
    .replace(/^(#{1,6}|>|[-*+]|\d+\.)\s+/, "")
    .replace(/\*\*|__|`/g, "")
    .slice(0, TITLE_LENGTH);
}
