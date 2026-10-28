import { Badge } from "@/components/ui/badge";

/** Marks a feature whose behavior and API may still change. */
export function ExperimentalBadge() {
  return (
    <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wide">
      Experimental
    </Badge>
  );
}
