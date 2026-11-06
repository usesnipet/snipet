/** Up to two letters standing in for a missing image: first letters of two words, else the start of the name. */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

/**
 * Black or white, whichever reads better on a "#rrggbb" background. Generated
 * colors can land anywhere from pale to dark; 0.179 is the WCAG luminance where
 * both reach the same contrast.
 */
export function readableTextColor(background: string) {
  const [red, green, blue] = [1, 3, 5]
    .map((start) => parseInt(background.slice(start, start + 2), 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
