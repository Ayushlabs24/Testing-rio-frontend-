"use client";

import { useState, type ReactNode } from "react";
import { AppFooter } from "@/components/layout/app-footer";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <AppSidebar collapsed={collapsed} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppTopbar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((v) => !v)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        <AppFooter />
      </div>
    </div>
  );
}
