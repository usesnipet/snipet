import logo from "@/assets/logo.svg";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img src={logo} alt="Snipet" className={cn("w-10 h-10", className)} />
  )
}