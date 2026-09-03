"use client"
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { Button } from "./button";

export type Props = React.ComponentProps<"input"> & {
  containerclassname?: string;
}
const Input = React.forwardRef<HTMLInputElement, Props>(
  ({ className, containerclassname, type, ...props }, ref) => {
    const [realType, setRealType] = React.useState(type);
    return (
      <div className={cn('relative', containerclassname)}>
        <input
          type={realType}
          className={cn(
            "flex h-10 w-full border border-input bg-background rounded-md px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          ref={ref}
          {...props}
        />
        {
          type === "password" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className='absolute right-2 top-1/2 -translate-y-1/2 hover:bg-transparent'
              onClick={() => setRealType(realType === "password" ? "text" : "password")}
            >
              { realType === "password" && <Eye className="w-4 h-4 text-input" /> }
              { realType === "text" && <EyeOff className="w-4 h-4 text-input" /> }
            </Button>
          )
        }
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
