import { SVG } from "@/components/ui/svg";
import { cn } from "@/lib/utils";
import stc from "string-to-color";

type Props = {
  /** Display name, used for the monogram fallback. */
  name: string;
  /** Registry key, used to derive a stable color. */
  providerKey: string;
  /** Raw SVG markup, an image URL/data URI, or undefined. */
  icon?: string;
  className?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

export function ProviderIcon({ name, providerKey, icon, className }: Props) {
  const box = cn("size-9 shrink-0 rounded-lg", className);
  const trimmed = icon?.trim();

  if (trimmed?.startsWith("<svg")) {
    return <SVG svg={trimmed} className={box} />;
  }

  if (trimmed && /^(https?:|data:|\/)/.test(trimmed)) {
    return <img src={trimmed} alt="" className={cn(box, "object-contain")} />;
  }

  return (
    <span
      className={cn(
        box,
        "flex items-center justify-center text-xs font-semibold text-white",
      )}
      style={{ backgroundColor: stc(providerKey) }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
