import { Search } from "lucide-react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Input>;

export function InputSearch({ className, ...props }: Props) {
  return (
    <div className="relative">
      <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 z-30" />
      <Input
        className={cn("pl-9", className)}
        type="search"
        placeholder="Search..."
        {...props}
      />
    </div>
  )
}