"use client"

import type * as React from "react"
import logo from "@/assets/logo.svg";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import type { VariantProps } from "class-variance-authority"
const loadingVariants = cva("animate-spin text-muted-foreground", {
  variants: {
    size: {
      default: "h-8 w-8",
      sm: "h-4 w-4",
      lg: "h-12 w-12",
      xl: "h-16 w-16",
      icon: "h-[1em] w-[1em]",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

export interface LoadingProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof loadingVariants> {
  /** Screen-reader text, also shown under the spinner. */
  label?: string
  /** Replaces the default spinner icon. */
  icon?: React.ReactNode
  variant?: "spinner" | "skeleton" | "pulse"
  /** How many skeleton/pulse rows to render. */
  count?: number
  /** Tailwind height class for each skeleton/pulse row. */
  height?: string
  /** Tailwind width class for every row, or one per row. */
  width?: string | string[]
  shape?: "circle" | "square" | "rect"
  withLogo?: boolean
}

export function Loading({
  label,
  icon,
  size,
  variant = "spinner",
  count = 3,
  height = "h-12",
  width = "w-full",
  shape = "rect",
  className,
  withLogo,
  ...props
}: LoadingProps) {

  const renderSpinner = () => (
    <div className="flex flex-col items-center justify-center gap-2" {...props}>
      {withLogo ? (
        <img src={logo} alt="snipet" className={cn(loadingVariants({ size }), className)} />
      ) : icon ? (
        <div className={cn(loadingVariants({ size }), className)}>{icon}</div>
      ) : (
        <Loader2 className={cn(loadingVariants({ size }), className)} />
      )}
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
      <span className="sr-only">{label}</span>
    </div>
  )

  const renderSkeleton = () => {
    const widths = Array.isArray(width) ? width : Array(count).fill(width)
    const shapeClasses = {
      circle: "rounded-full",
      square: "rounded-md aspect-square",
      rect: "rounded-md",
    }

    return (
      <div className="space-y-2" {...props}>
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "animate-pulse bg-muted",
              height,
              widths[index % widths.length],
              shapeClasses[shape],
              className,
            )}
            aria-hidden="true"
          />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    )
  }

  const renderPulse = () => {
    const widths = Array.isArray(width) ? width : Array(count).fill(width)

    return (
      <div className="space-y-2" {...props}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className={cn("flex items-center space-x-4", className)}>
            {shape === "circle" && (
              <div className={cn("animate-pulse bg-muted rounded-full h-12 w-12")} aria-hidden="true" />
            )}
            <div className="space-y-2 flex-1">
              <div className={cn("animate-pulse bg-muted h-4", widths[index % widths.length])} aria-hidden="true" />
              {shape === "rect" && <div className="animate-pulse bg-muted h-4 w-[60%]" aria-hidden="true" />}
            </div>
          </div>
        ))}
        <span className="sr-only">{label}</span>
      </div>
    )
  }

  switch (variant) {
    case "skeleton":
      return renderSkeleton()
    case "pulse":
      return renderPulse()
    case "spinner":
    default:
      return renderSpinner()
  }
}
