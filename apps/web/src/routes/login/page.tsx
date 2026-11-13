import { LoginForm } from "@/features/auth/components/login-form";
import { LoginHub } from "@/features/auth/components/login-hub";
import { useIsAuthenticated, useLogin } from "@/features/auth/hooks";
import { ROUTES } from "@/routes";
import { Navigate } from "react-router";

export function LoginPage() {
  const isAuthenticated = useIsAuthenticated();
  const login = useLogin();

  // Only for someone who lands here already signed in; a fresh sign-in navigates itself, with its fade.
  if (isAuthenticated && login.isIdle) return <Navigate to={ROUTES.chat} replace />;

  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <LoginHub className="mb-10 size-14" />
        <h1 className="text-3xl font-semibold tracking-tight">Sign in to Snipet</h1>
        <p className="text-muted-foreground mt-2 text-[15px] text-pretty">Use the account an admin created for you.</p>
        <div className="mt-8">
          <LoginForm login={login} />
        </div>
        <p className="text-muted-foreground mt-6 text-sm">Forgot your password? Ask an admin to reset it.</p>
      </div>
    </main>
  );
}
