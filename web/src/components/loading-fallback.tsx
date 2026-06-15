import { Loading } from "./ui/loading";

export const LoadingFallback = () => {
  return (
    <div className="flex min-h-0 h-full flex-1 items-center justify-center">
      <Loading withLogo size="xl" />
    </div>
  )
}
