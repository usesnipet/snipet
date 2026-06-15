import { DurationSelect } from "@/components/duration-select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useFormContext } from "react-hook-form";

import type { DurationSelectOption, DurationSelectProps } from "@/components/duration-select";

type Props = Pick<DurationSelectProps, "options" | "placeholder" | "className"> & {
  label?: string;
  name: string;
  fieldclassname?: string;
};

export const FormDurationSelect = (props: Props) => {
  const form = useFormContext();
  const isLoading = form.formState.isSubmitting;

  return (
    <FormField
      control={form.control}
      name={props.name}
      render={({ field }) => (
        <FormItem className={props.fieldclassname}>
          {props.label && <FormLabel>{props.label}</FormLabel>}
          <FormControl>
            <DurationSelect
              value={field.value}
              onValueChange={field.onChange}
              options={props.options}
              placeholder={props.placeholder}
              disabled={isLoading}
              className={props.className}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export type { DurationSelectOption };
