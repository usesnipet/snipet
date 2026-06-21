import { FormInput } from "@/components/form/input";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Link } from "@/components/ui/link";
import { Separator } from "@/components/ui/separator";
import { loginSchema, useLogin } from "@/hooks/api/use-login";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

export function LoginPage() {
  const form = useForm({ resolver: zodResolver(loginSchema) });
  const { mutate: login } = useLogin();
  const onSubmit = form.handleSubmit(data => login(data));

  return (
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
        <Separator />
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          Don&apos;t have an account?
          <Link href="/register">Register</Link>
        </p>
      </form>
    </Form>
  )
}