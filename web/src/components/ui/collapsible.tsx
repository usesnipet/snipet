"use client"

import { cn } from "@/lib/utils"
import { Collapsible as CollapsiblePrimitive } from "radix-ui"
import type { ComponentProps } from "react"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.Trigger

function CollapsibleContent({
  className,
  children,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      className={cn(
        "overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        className
      )}
      {...props}
    >
      {children}
    </CollapsiblePrimitive.Content>
  )
}

export { Collapsible, CollapsibleContent, CollapsibleTrigger }
