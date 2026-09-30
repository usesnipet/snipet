import { AlertCircle } from "lucide-react";

export function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="flex flex-col gap-2 items-center justify-center h-full">
      <AlertCircle className="size-10 text-destructive" />
      <h1 className="text-2xl font-semibold tracking-tight">Error</h1>
      <p className="text-muted-foreground text-sm">{error.message}</p>
    </div>
  )
}