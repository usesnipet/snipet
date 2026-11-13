import { Plus, X } from "lucide-react";
import { useState } from "react";
import { useFormContext } from "react-hook-form";

import { Button } from "../ui/button";
import { FormDescription, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";

type Props = {
  name: string;
  label: string;
  /** Shown under the label. */
  description?: React.ReactNode;
  placeholder?: string;
  addLabel?: string;
};

/** Edits a string array as one text input per item, each showing its own validation error. */
export const FormStringList = ({ name, label, description, placeholder, addLabel = "Add" }: Props) => {
  const form = useFormContext();
  const isSubmitting = form.formState.isSubmitting;
  // Only a row the user just added takes focus, not every row when the form opens.
  const [addedIndex, setAddedIndex] = useState<number>();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const items: string[] = field.value ?? [];
        // A failing item nests its error by index, so the field's error is array-like then.
        const itemErrors = fieldState.error as unknown as Record<number, { message?: string } | undefined> | undefined;

        return (
          <FormItem role="group" aria-label={label}>
            <FormLabel>{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
            {items.map((item, index) => {
              const itemError = itemErrors?.[index]?.message;
              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={item}
                      containerclassname="flex-1"
                      placeholder={placeholder}
                      disabled={isSubmitting}
                      autoFocus={index === addedIndex}
                      aria-label={`${label} ${index + 1}`}
                      aria-invalid={!!itemError}
                      onBlur={field.onBlur}
                      onChange={(event) =>
                        field.onChange(items.map((other, i) => (i === index ? event.target.value.trim() : other)))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isSubmitting}
                      aria-label={`Remove ${label} ${index + 1}`}
                      onClick={() => field.onChange(items.filter((_, i) => i !== index))}
                    >
                      <X />
                    </Button>
                  </div>
                  {itemError && <p className="text-destructive text-sm font-medium">{itemError}</p>}
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => {
                setAddedIndex(items.length);
                field.onChange([...items, ""]);
              }}
            >
              <Plus />
              {addLabel}
            </Button>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};
