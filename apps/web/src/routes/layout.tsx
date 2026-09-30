"use client"

import { AnimatedOutlet } from "@/components/animated-outlet";
import { Sidebar } from "@/components/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function Layout() {
  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset className="h-dvh min-w-0 overflow-hidden">
        <AnimatedOutlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
