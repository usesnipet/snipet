import { FormInput } from "@/components/form/input";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { loginSchema, useLogin } from "@/hooks/api/use-login";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import type { LoginSchema } from "@/hooks/api/use-login";
export function LoginPage() {
  const form = useForm<LoginSchema>({ resolver: zodResolver(loginSchema) });

  const { mutate: login } = useLogin();

  const onSubmit = form.handleSubmit(async (data) => {
    login(data, {
      onSuccess: (data) => {
        console.log(data);
      }
    });
  });

  return (
    <div className="w-1/2 m-auto h-screen flex flex-col items-center justify-center space-y-4">
      <div className="flex gap-2 items-center">
        <Logo className="w-10 h-10" />
        <h1 className="text-2xl font-bold">
          Welcome back!
        </h1>
      </div>
      <div className="w-full flex justify-center items-center">
        <Form {...form}>
          <form onSubmit={onSubmit} className="w-full max-w-md space-y-4">
            <FormInput
              name="account"
              label="Email or Nickname"
              autoComplete="username"
            />
            <FormInput
              name="password"
              label="Password"
              type="password"
              autoComplete="current-password"
            />
            <Button type="submit">Login</Button>
          </form>
        </Form>
      </div>
    </div>
  )
}