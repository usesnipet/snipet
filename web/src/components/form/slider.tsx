import { useFormContext } from "react-hook-form";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
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
};

export const FormSlider = ({
  name,
  label,
  fieldclassname,
  min = 0,
  max = 100,
  step = 1,
  showValue = false,
}: Props) => {
  const form = useFormContext();
  const isLoading = form.formState.isSubmitting;
  const value = form.watch(name) as number | undefined;

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("relative space-y-2", fieldclassname)}>
          {label ? <FormLabel>{label}</FormLabel> : null}
          {showValue && typeof value === "number" ? (
            <span className="absolute right-0 top-0 text-sm text-muted-foreground">
              {value.toFixed(1)}
            </span>
          ) : null}
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
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
