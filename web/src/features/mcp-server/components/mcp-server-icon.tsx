import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import stc from "string-to-color";

type Props = {
  name: string;
  /** Image URL from the registry entry, if the server came from one. */
  icon?: string;
  className?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

export function McpServerIcon({ name, icon, className }: Props) {
  return (
    <Avatar className={cn("size-9 shrink-0 rounded-lg", className)}>
      {icon && <AvatarImage src={icon} alt="" className="object-contain" />}
      <AvatarFallback
        className="rounded-lg text-xs font-semibold text-white"
        style={{ backgroundColor: stc(name) }}
      >
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
