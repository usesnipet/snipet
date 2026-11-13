import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SVG } from "@/components/ui/svg";
import { initials } from "@/lib/avatar-fallback";
import { cn } from "@/lib/utils";
import stc from "string-to-color";

type Props = {
  /** Display name, used for the monogram fallback. */
  name: string;
  /** Raw SVG markup, an image URL/data URI, or undefined. */
  icon?: string;
  className?: string;
};

export function Icon({ name, icon, className }: Props) {
  const trimmed = icon?.trim();
  const isRawSvg = trimmed?.startsWith("<svg");
  const isUrl = !isRawSvg && trimmed && /^(https?:|data:|\/)/.test(trimmed);

  return (
    <Avatar className={cn("size-9 rounded-full bg-white", className)}>
      {isUrl && <AvatarImage src={trimmed} alt="" className="object-contain rounded-full" />}
      <AvatarFallback
        className="rounded-full text-xs font-semibold text-foreground"
        style={isRawSvg ? undefined : { backgroundColor: stc(name) }}
      >
        {isRawSvg ? <SVG svg={trimmed!} className="size-full rounded-full" /> : initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
