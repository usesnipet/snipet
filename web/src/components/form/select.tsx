import { useFormContext } from "react-hook-form";

import { Button } from "../ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
  label?: string;
  name: string;
  fieldclassname?: string;
  disabled?: boolean;
  options: { label: string; value: string }[];
  placeholder?: string;
  /**
   * Intercepts the value change of the select.
   * - returns `null` to prevent the value update in the react-hook-form
   * - returns `string` to substitute the sent value
   * - returns `undefined` to use the original value
   */
  onValueChange?: (value: string) => string | null | undefined;
  action?: Parameters<typeof Button>[0] & {
    icon?: React.ReactNode;
    label?: string;
  }
};

export const FormSelect = (props: Props) => {
  const form = useFormContext();
  const isLoading = form.formState.isSubmitting;

  const ActionButton = () => {
    if (!props.action) return null;
    return (
      <Button
        type="button"
        disabled={props.action.disabled ?? false}
        size={props.action.size ?? 'default'}
        variant={props.action.variant ?? 'outline'}
        onClick={props.action.onClick}
      >
        {props.action.icon}
        {props.action.label}
      </Button>
    )

  }

  return (
    <FormField
      control={form.control}
      name={props.name}
      render={({ field }) => (
        <FormItem className={props.fieldclassname}>
          {props.label && <FormLabel>{props.label}</FormLabel>}
          <FormControl>
            <div className="flex gap-2 items-end">
              <Select
                disabled={isLoading || props.disabled}
                value={field.value ? String(field.value) : undefined}
                onValueChange={(nextValue) => {
                  const intercepted = props.onValueChange?.(nextValue);

                  if (intercepted === null) return;
                  if (typeof intercepted === "string") {
                    field.onChange(intercepted);
                    return;
                  }

                  field.onChange(nextValue);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={props.placeholder ?? "Select an option"} />
                </SelectTrigger>
                <SelectContent>
                  {
                    props.options.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              <ActionButton />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
