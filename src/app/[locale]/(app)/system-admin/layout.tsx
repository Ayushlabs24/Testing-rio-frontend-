"use client";

import type { ReactNode } from "react";
import { SystemAdminGuard } from "@/components/layout/system-admin-guard";

export default function SystemAdminLayout({ children }: { children: ReactNode }) {
  return <SystemAdminGuard>{children}</SystemAdminGuard>;
}
