import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormInput } from "@/components/form/input";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Spinner } from "@/components/ui/spinner";

import { loginSchema } from "@snipet/shared";

import type { useLogin } from "../hooks";
import type { Login } from "@snipet/shared";

const defaultValues: Login = { username: "", password: "" };

/** The sign-in fields; the page owns the mutation so its artwork can follow the request. */
export function LoginForm({ login }: { login: ReturnType<typeof useLogin> }) {
  const form = useForm<Login>({
    resolver: zodResolver(loginSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await login.mutateAsync(values).catch(() => {});
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <FormInput name="username" label="Username" autoComplete="username" autoFocus />
          <FormInput name="password" label="Password" type="password" autoComplete="current-password" />
        </FieldGroup>
        <Button type="submit" className="mt-6 h-10 w-full text-sm" disabled={login.isPending}>
          {login.isPending && <Spinner size="sm" />}
          {login.isPending ? "Signing in" : "Sign in"}
        </Button>
      </form>
    </Form>
  );
}
