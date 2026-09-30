import { useId, useMemo } from "react";
import Form from "@rjsf/shadcn";
import validator from "@rjsf/validator-ajv8";

import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { buildPasswordUiSchema } from "./password-ui-schema";

import type { DialogInstanceProps } from "@/lib/dialog";
import type { IChangeEvent } from "@rjsf/core";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";

export type SchemaFormDialogProps = DialogInstanceProps<{
  title: string;
  description?: string;
  schema: RJSFSchema;
  formData?: Record<string, unknown>;
  onSubmit: (formData: Record<string, unknown>) => void;
}>;

const FORM_ID_PREFIX = "schema-form-dialog";

export function SchemaFormDialog({
  title,
  description,
  schema,
  formData,
  onSubmit,
  close,
}: SchemaFormDialogProps) {
  const formId = `${FORM_ID_PREFIX}-${useId()}`;

  const uiSchema = useMemo<UiSchema>(() => {
    return {
      ...buildPasswordUiSchema(schema),
      "ui:submitButtonOptions": { norender: true },
    };
  }, [schema]);

  const handleSubmit = (data: IChangeEvent<Record<string, unknown>>) => {
    onSubmit(data.formData ?? {});
    close();
  };

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description ? (
          <DialogDescription>{description}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">
            Configure {title}
          </DialogDescription>
        )}
      </DialogHeader>

      <Form
        id={formId}
        schema={schema}
        formData={formData}
        validator={validator}
        uiSchema={uiSchema}
        onSubmit={handleSubmit}
        liveValidate={false}
        showErrorList={false}
      />

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" form={formId}>
          Apply
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
