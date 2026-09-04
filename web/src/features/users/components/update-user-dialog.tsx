import { FormInput } from "@/components/form/input";
import { Button } from "@/components/ui/button";
import {
  DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useUpdateUser } from "../hooks";
import { updateUserSchema } from "../schemas";

import { RoleSelect } from "./role-select";

import type { UpdateUser, User } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type UpdateUserDialogProps = DialogInstanceProps<{
  user: User;
}>;

// Password is optional on update — blank keeps the current password, so an
// empty string must skip the min-length check that applies when it's set.
const updateUserFormSchema = updateUserSchema.extend({
  password: z
    .string()
    .max(255)
    .refine((value) => value.length === 0 || value.length >= 8, "Must be at least 8 characters")
    .optional(),
});
type UpdateUserForm = z.infer<typeof updateUserFormSchema>;

export function UpdateUserDialog({ user, close }: UpdateUserDialogProps) {
  const formId = `update-user-${useId()}`;
  const form = useForm<UpdateUserForm>({
    resolver: zodResolver(updateUserFormSchema),
    defaultValues: {
      name: user.name,
      password: "",
      role: user.role,
    },
  });

  const { mutateAsync, isPending } = useUpdateUser();

  const onSubmit = form.handleSubmit(async (values) => {
    const data: UpdateUser = { name: values.name, role: values.role };
    if (values.password) data.password = values.password;

    await mutateAsync({ id: user.id, data });
    close();
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Edit user</DialogTitle>
        <DialogDescription>
          Update settings for{" "}
          <span className="font-medium text-foreground">{user.name}</span>.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form id={formId} onSubmit={onSubmit} className="space-y-4">
          <FormInput name="name" label="Name" />
          <FormInput
            name="password"
            label="Password"
            type="password"
            placeholder="Leave blank to keep current password"
            description="Leave blank to keep the current password."
          />
          <RoleSelect name="role" />
        </form>
      </Form>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isPending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" form={formId} disabled={isPending}>
          {isPending && <Spinner size="sm" />}
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
