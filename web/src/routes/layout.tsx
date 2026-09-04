"use client"

import { AnimatedOutlet } from "@/components/animated-outlet";
import { RequireAuth } from "@/components/require-auth";
import { Sidebar } from "@/components/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function Layout() {
  return (
    <RequireAuth>
      <SidebarProvider>
        <Sidebar />
        <SidebarInset className="h-dvh min-w-0 overflow-hidden">
          <AnimatedOutlet />
        </SidebarInset>
      </SidebarProvider>
    </RequireAuth>
  )
}
