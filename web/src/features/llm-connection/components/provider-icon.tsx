import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const trimmed = icon?.trim();
  const isRawSvg = trimmed?.startsWith("<svg");
  const isUrl = !isRawSvg && trimmed && /^(https?:|data:|\/)/.test(trimmed);

  return (
    <Avatar className={cn("size-9 rounded-full bg-primary", className)}>
      {isUrl && <AvatarImage src={trimmed} alt="" className="object-contain" />}
      <AvatarFallback
        className="rounded-lg text-xs font-semibold text-white"
        style={isRawSvg ? undefined : { backgroundColor: stc(providerKey) }}
      >
        {isRawSvg ? <SVG svg={trimmed!} className="size-full" /> : initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
