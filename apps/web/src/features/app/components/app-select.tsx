import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useFormContext } from "react-hook-form";

import { useListApps } from "@snipet/client";

type Props = {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  name: string;
  fieldclassname?: string;
};

export const FormAppSelect = ({
  placeholder = "Select app",
  ...props
}: Props) => {
  const form = useFormContext();
  const isLoading = form.formState.isSubmitting;
  const { data: apps, isLoading: isLoadingApps } = useListApps();

  const disabled = isLoading || isLoadingApps || props.disabled;

  return (
    <FormField
      control={form.control}
      name={props.name}
      render={({ field }) => (
        <FormItem className={props.fieldclassname}>
          {props.label && <FormLabel>{props.label}</FormLabel>}
          <FormControl>
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <SelectTrigger className={cn("w-full", props.className)}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {apps?.data?.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};