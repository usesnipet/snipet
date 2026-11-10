import { LoginForm } from "@/features/auth/components/login-form";
import { useIsAuthenticated } from "@/features/auth/hooks";
import { ROUTES } from "@/routes";
import { enterUp } from "@/lib/motion";
import { motion } from "motion/react";
import { Navigate } from "react-router";

export function LoginPage() {
  const isAuthenticated = useIsAuthenticated();

  if (isAuthenticated) return <Navigate to={ROUTES.chat} replace />;

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      {/* The app's one page-load sequence: the heading, then the form a beat later. */}
      <div className="w-full max-w-sm space-y-6">
        <motion.div className="space-y-1.5 text-center" {...enterUp}>
          <span className="bg-primary text-primary-foreground mx-auto flex size-9 items-center justify-center rounded-lg text-xs font-bold">
            Sn
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Sign in to Snipet</h1>
          <p className="text-muted-foreground text-sm text-pretty">
            No self-service password reset — ask an admin to reset it for you.
          </p>
        </motion.div>
        <motion.div {...enterUp} transition={{ ...enterUp.transition, delay: 0.08 }}>
          <LoginForm />
        </motion.div>
      </div>
    </div>
  );
}
