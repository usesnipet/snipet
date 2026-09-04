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

import { useCreateUser } from "../hooks";
import { createUserSchema } from "../schemas";

import { RoleSelect } from "./role-select";

import type { CreateUser, User } from "../schemas";
import type { DialogInstanceProps } from "@/lib/dialog";

type CreateUserDialogProps = DialogInstanceProps<{
  onCreated?: (user: User) => void;
}>;

const defaultValues: CreateUser = {
  username: "",
  name: "",
  password: "",
  role: "user",
};

export function CreateUserDialog({ onCreated, close }: CreateUserDialogProps) {
  const formId = `create-user-${useId()}`;
  const form = useForm<CreateUser>({
    resolver: zodResolver(createUserSchema),
    defaultValues,
  });

  const { mutateAsync, isPending } = useCreateUser();

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await mutateAsync({ data: values });
    form.reset();
    onCreated?.(result);
    close();
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>New user</DialogTitle>
        <DialogDescription>
          Create a login for a teammate — they can sign in with this username and password.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form id={formId} onSubmit={onSubmit} className="space-y-4">
          <FormInput name="username" label="Username" />
          <FormInput name="name" label="Name" />
          <FormInput name="password" label="Password" type="password" />
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
          Create user
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
