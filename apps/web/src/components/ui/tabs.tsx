"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/** The selected tab and an id scoping its indicator, so two tab sets on one page don't trade indicators. */
const TabsStateContext = React.createContext<{ value: string | undefined; id: string } | null>(null);

/** Radix doesn't expose the selected value to triggers, so it's mirrored here for the sliding indicator. */
function Tabs({ value, defaultValue, onValueChange, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const selectedValue = value ?? uncontrolledValue;
  const id = React.useId();

  const handleValueChange = (next: string) => {
    setUncontrolledValue(next);
    onValueChange?.(next);
  };

  return (
    <TabsStateContext.Provider value={{ value: selectedValue, id }}>
      <TabsPrimitive.Root value={selectedValue} onValueChange={handleValueChange} {...props} />
    </TabsStateContext.Provider>
  );
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const state = React.useContext(TabsStateContext);
  const isActive = state?.value === props.value;

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "relative inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    >
      {isActive && (
        <motion.span
          layoutId={`tabs-indicator-${state.id}`}
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className="absolute inset-0 rounded-sm bg-background shadow-sm"
        />
      )}
      {/* Above the indicator; inherits the trigger's gap and alignment. */}
      <span className="relative inline-flex items-center gap-[inherit]">{children}</span>
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
