import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormInput } from "@/components/form/input";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";

import { useLogin } from "../hooks";
import { loginSchema } from "../schemas";

import type { Login } from "../schemas";

const defaultValues: Login = { username: "", password: "" };

export function LoginForm() {
  const form = useForm<Login>({
    resolver: zodResolver(loginSchema),
    defaultValues,
  });

  const { mutateAsync, isPending } = useLogin();

  const onSubmit = form.handleSubmit(async (values) => {
    await mutateAsync(values).catch(() => {});
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <FormInput
            name="username"
            label="Username"
            autoComplete="username"
            autoFocus
          />
          <FormInput
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
          />
        </FieldGroup>
        <Button type="submit" className="mt-6 w-full" disabled={isPending}>
          {isPending && <Spinner size="sm" />}
          Sign in
        </Button>
      </form>
    </Form>
  );
}
