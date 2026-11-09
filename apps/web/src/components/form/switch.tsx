import { Switch as SwitchPrimitives } from "radix-ui";
import React from "react";
import { useFormContext } from "react-hook-form";

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Switch } from "../ui/switch";
import { cn } from "@/lib/utils";

type Props = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  label?: string;
  /** Shown under the label; the switch then moves to the right of both. */
  description?: React.ReactNode;
  name: string;
  fieldclassname?: string;
};
export const FormSwitch = ({ description, ...props }: Props) => {
  const form = useFormContext();
  const isLoading = form.formState.isSubmitting;

  return (
    <FormField
      control={form.control}
      name={props.name}
      render={({ field }) =>
        description ? (
          <FormItem className={cn("flex items-start justify-between gap-4", props.fieldclassname)}>
            <div className="space-y-1">
              {props.label && <FormLabel>{props.label}</FormLabel>}
              <FormDescription>{description}</FormDescription>
              <FormMessage />
            </div>
            <FormControl>
              <Switch disabled={isLoading} checked={!!field.value} onCheckedChange={field.onChange} {...props} />
            </FormControl>
          </FormItem>
        ) : (
          <FormItem className={cn("flex items-center gap-2", props.fieldclassname)}>
            {props.label && <FormLabel>{props.label}</FormLabel>}
            <FormControl>
              <Switch disabled={isLoading} checked={!!field.value} onCheckedChange={field.onChange} {...props} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }
    />
  );
};
