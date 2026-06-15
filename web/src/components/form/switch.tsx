import * as SwitchPrimitives from "@radix-ui/react-switch";
import React from "react";
import { useFormContext } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Switch } from "../ui/switch";
import { cn } from "@/lib/utils";

type Props = React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
  label?: string
  name: string
  fieldclassname?: string
}
export const FormSwitch = (props: Props) => {
  const form = useFormContext();
  const isLoading = form.formState.isSubmitting;

  return (
    <FormField
      control={form.control}
      name={props.name}
      render={({ field }) => (
        <FormItem className={cn("flex items-center gap-2", props.fieldclassname)}>
          {props.label && (<FormLabel>{props.label}</FormLabel>)}
          <FormControl>
            <Switch
              disabled={isLoading}
              checked={!!field.value}
              onCheckedChange={field.onChange}
              {...props}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};