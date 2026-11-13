import { useFormContext } from "react-hook-form";

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Slider } from "../ui/slider";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  label?: string;
  fieldclassname?: string;
  min?: number;
  max?: number;
  step?: number;
  showValue?: boolean;
  description?: string;
};

export const FormSlider = ({
  name,
  label,
  fieldclassname,
  min = 0,
  max = 100,
  step = 1,
  showValue = false,
  description,
}: Props) => {
  const form = useFormContext();
  const isLoading = form.formState.isSubmitting;
  const value = form.watch(name) as number | undefined;

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("space-y-3", fieldclassname)}>
          <div className="flex items-center justify-between gap-2">
            {label ? <FormLabel>{label}</FormLabel> : null}
            {showValue && typeof value === "number" ? (
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">{value}</span>
            ) : null}
          </div>
          <FormControl>
            <Slider
              disabled={isLoading}
              min={min}
              max={max}
              step={step}
              value={[typeof field.value === "number" ? field.value : min]}
              onValueChange={([next]) => field.onChange(next)}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
