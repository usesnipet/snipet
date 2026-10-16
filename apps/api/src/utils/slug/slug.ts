/**
 * text as a lowercase ASCII slug for paths and URLs ("Suporte Técnico" is
 * "suporte-tecnico"), at most maxLength long; "" when nothing is left.
 */
export function slugify(text: string, maxLength = 40): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");
}
