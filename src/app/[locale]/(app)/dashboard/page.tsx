"use client";

import { Building2, LayoutGrid, ShieldCheck, Users2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { rolesService } from "@/services/roles/roles.service";
import { usersService } from "@/services/users/users.service";
import { PERMISSION_MODULES } from "@/types/permissions";

export default function DashboardPage() {
  const t = useTranslations("app.dashboard");
  const { session } = useAuth();
  const [userCount, setUserCount] = useState<number | null>(null);
  const [roleCount, setRoleCount] = useState<number | null>(null);

  useEffect(() => {
    usersService.listByOrganization().then((users) => setUserCount(users.length));
    rolesService.list().then((roles) => setRoleCount(roles.length));
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title={t("title", { name: session?.user.name ?? "" })}
        description={t("description")}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.organizations")} value={1} icon={Building2} />
        <StatCard label={t("stats.users")} value={userCount ?? 0} icon={Users2} />
        <StatCard label={t("stats.roles")} value={roleCount ?? 0} icon={ShieldCheck} />
        <StatCard
          label={t("stats.modules")}
          value={PERMISSION_MODULES.length}
          icon={LayoutGrid}
        />
      </div>
    </PageContainer>
  );
}
