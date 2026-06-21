import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Outlet, useLocation } from "react-router-dom";

export function AuthLayout() {
  const { pathname } = useLocation();
  const isLogin = pathname === "/login";
  const isRegister = pathname === "/register";
  const title = isLogin ? "Login to your account" : isRegister ? "Register to your account" : "";
  const description = isLogin ? "Enter your email below to login to your account" : isRegister ? "Enter your email below to register to your account" : "";

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className={"flex flex-col gap-6"}>
          <Card>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>
                {description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Outlet />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
