import { FormInput } from "@/components/form/input";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Link } from "@/components/ui/link";
import { Separator } from "@/components/ui/separator";
import { registerSchema, useRegister } from "@/hooks/api/use-register";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

export function RegisterPage() {
  const form = useForm({ resolver: zodResolver(registerSchema) });
  const { mutate: register } = useRegister();
  const onSubmit = form.handleSubmit(data => register(data));

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4">
        <FormInput
          name="nickname"
          label="Nickname"
          autoComplete="nickname"
        />
        <FormInput
          name="name"
          label="Name"
          autoComplete="name"
        />
        <FormInput
          name="email"
          label="Email"
          autoComplete="email"
        />
        <FormInput
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
        />
        <FormInput
          name="confirmPassword"
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
        />
        <Button type="submit">Register</Button>
        <Separator />
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          Already have an account?
          <Link href="/login">Login</Link>
        </p>
      </form>
    </Form>
  )
}