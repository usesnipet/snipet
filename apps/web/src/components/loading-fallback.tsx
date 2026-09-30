import { cn } from "@/lib/utils";

import { Loading } from "./ui/loading";

export const LoadingFallback = ({ className = "" }: { className?: string } ) => {
  return (
    <div className={cn("flex min-h-0 h-full flex-1 items-center justify-center", className)}>
      <Loading size="xl" />
    </div>
  )
}
