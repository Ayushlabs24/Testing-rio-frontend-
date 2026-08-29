"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Search, Trash2, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ModuleAccessList } from "@/components/features/settings/module-access-list";
import { LoadingButton } from "@/components/common/loading-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { useAuth } from "@/components/providers/auth-provider";
import { USERS_PAGE_SIZE } from "@/config/pagination";
import { usePermission } from "@/hooks/use-permission";
import { rolesService } from "@/services/roles/roles.service";
import type { RoleSummary } from "@/services/roles/roles.types";
import { usersService } from "@/services/users/users.service";
import type { PlatformUser, UserStatus } from "@/services/users/users.types";

const ALL = "all";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StatusBadge({ status, label }: { status: UserStatus; label: string }) {
  return (
    <Badge
      variant={status === "active" ? "default" : "outline"}
      className={
        status === "active"
          ? "bg-badge-success text-badge-success-foreground border-transparent"
          : undefined
      }
    >
      {label}
    </Badge>
  );
}

interface UserDialogProps {
  roles: RoleSummary[];
  /** The caller's own org — used to enrich a plain `OrgUser` into a `PlatformUser` after creating one (the response itself doesn't carry it). */
  currentOrganization: { id: string; name: string };
  user?: PlatformUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: PlatformUser) => void;
}

function UserDialog({
  roles,
  currentOrganization,
  user,
  open,
  onOpenChange,
  onSaved,
}: UserDialogProps) {
  const t = useTranslations("app.settings.users");
  const tValidation = useTranslations("auth.validation");
  const [formError, setFormError] = useState<string | null>(null);
  // Set only right after a successful create — shows a confirmation step
  // (emailed, or the temporary password itself if the mailer isn't
  // configured) instead of immediately closing the dialog, since this is
  // the one chance to hand the new user their credentials.
  const [credentials, setCredentials] = useState<{
    email: string;
    temporaryPasswordEmailed: boolean;
    temporaryPassword?: string;
  } | null>(null);
  const isEdit = Boolean(user);

  const handleOpenChange = (next: boolean) => {
    if (!next) setCredentials(null);
    onOpenChange(next);
  };

  const schema = z.object({
    name: z.string().min(1, { message: tValidation("nameRequired") }),
    email: z.string().email({ message: tValidation("emailInvalid") }),
    roleId: z.string().min(1, { message: tValidation("roleRequired") }),
    status: z.enum(["active", "invited", "disabled"]),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      roleId: user?.role.id ?? "",
      status: user?.status ?? "active",
    },
  });

  const selectedRoleId = useWatch({ control, name: "roleId" });
  const selectedStatus = useWatch({ control, name: "status" });
  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  // `roles` is the assignable set (cross-entity + Citizen Guest filtered out).
  // When editing someone who already holds a non-assignable role, keep it in
  // the options so the Select shows their current role instead of a blank —
  // it simply can't be freshly assigned to anyone via this entity screen.
  const roleOptions = useMemo<Array<Pick<RoleSummary, "id" | "name">>>(() => {
    if (user && !roles.some((role) => role.id === user.role.id)) {
      return [user.role, ...roles];
    }
    return roles;
  }, [roles, user]);

  const onSubmit = async (values: Values) => {
    setFormError(null);
    try {
      if (isEdit) {
        const changes = {
          name: values.name,
          roleId: values.roleId,
          status: values.status,
        };
        const updated = await usersService.update(user!.id, changes);
        onSaved({
          ...updated,
          organizationId: user!.organizationId,
          organizationName: user!.organizationName,
        });
        reset();
        onOpenChange(false);
        return;
      }

      // The backend scopes creation to the caller's own organization but
      // returns a plain `OrgUser` (no org id/name) — attach it from what we
      // already know, same as the update path above. Only the declared
      // CreateUserPayload fields are sent; `status` isn't part of create
      // (new users are always active) and would otherwise leak into the
      // request body since `values` is a superset.
      const created = await usersService.create({
        name: values.name,
        email: values.email,
        roleId: values.roleId,
      });
      onSaved({
        ...created,
        organizationId: currentOrganization.id,
        organizationName: currentOrganization.name,
      });
      reset();
      // Don't close yet — the temporary password (or emailed confirmation)
      // needs to be shown to the admin first; see the `credentials` state.
      setCredentials({
        email: created.email,
        temporaryPasswordEmailed: created.temporaryPasswordEmailed,
        temporaryPassword: created.temporaryPassword,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("genericError"));
    }
  };

  if (credentials) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("newUserTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-foreground text-sm">
              {t("userCreatedSuccess", { email: credentials.email })}
            </p>
            {credentials.temporaryPasswordEmailed ? (
              <p className="border-badge-success bg-badge-success/40 text-badge-success-foreground rounded-md border p-3 text-sm">
                {t("temporaryPasswordEmailed")}
              </p>
            ) : (
              <div className="border-warning/40 bg-warning/10 space-y-2 rounded-md border p-3">
                <p className="text-foreground text-sm">
                  {t("temporaryPasswordNotEmailed")}
                </p>
                <p className="border-border bg-background rounded-md border px-3 py-2 font-mono text-sm">
                  {credentials.temporaryPassword}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t("temporaryPasswordHint")}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => handleOpenChange(false)}>
              {t("done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-primary">
            {isEdit ? t("editUserTitle") : t("newUserTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 p-3 sm:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("nameLabel")}</Label>
              <Input id="name" {...register("name")} />
              {errors.name ? (
                <p className="text-destructive text-sm">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input id="email" type="email" disabled={isEdit} {...register("email")} />
              {errors.email ? (
                <p className="text-destructive text-sm">{errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleId">{t("roleLabel")}</Label>
              <Select
                value={selectedRoleId}
                onValueChange={(value) => setValue("roleId", value)}
              >
                <SelectTrigger id="roleId" className="w-full">
                  <SelectValue placeholder={t("rolePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.roleId ? (
                <p className="text-destructive text-sm">{errors.roleId.message}</p>
              ) : null}
            </div>

            {isEdit ? (
              <div className="space-y-2">
                <Label htmlFor="status">{t("statusColumn")}</Label>
                <Select
                  value={selectedStatus}
                  onValueChange={(value) => setValue("status", value as UserStatus)}
                >
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("status.active")}</SelectItem>
                    <SelectItem value="invited">{t("status.invited")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </div>

          <div className="border-border bg-muted/30 rounded-md border p-3">
            <p className="text-muted-foreground mb-1 text-xs font-medium">
              {t("derivedPermissions")}
            </p>
            {selectedRole ? (
              <div className="max-h-72 overflow-y-auto pr-1">
                <ModuleAccessList permissions={selectedRole.permissions} />
              </div>
            ) : (
              <p className="text-muted-foreground py-6 text-center text-xs">
                {t("rolePlaceholder")}
              </p>
            )}
          </div>

          <DialogFooter className="sm:col-span-2">
            <LoadingButton
              type="submit"
              isLoading={isSubmitting}
              text={
                isSubmitting
                  ? isEdit
                    ? t("saving")
                    : t("creating")
                  : isEdit
                    ? t("save")
                    : t("create")
              }
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserAlert({
  user,
  onDeleted,
  trigger,
}: {
  user: PlatformUser;
  onDeleted: (id: string) => void;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("app.settings.users");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    try {
      await usersService.remove(user.id);
      onDeleted(user.id);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteDescription", { name: user.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>{t("delete")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UserDetailSheet({
  user,
  role,
  isCrossEntity,
  open,
  onOpenChange,
  canWrite,
  onEdit,
  onDeleted,
}: {
  user: PlatformUser | null;
  role: RoleSummary | undefined;
  isCrossEntity: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canWrite: boolean;
  onEdit: () => void;
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("app.settings.users");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-xl">
        {user ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarFallback className="text-sm font-medium">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle>{user.name}</SheetTitle>
                  <SheetDescription>{user.email}</SheetDescription>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {isCrossEntity ? (
                  <Badge variant="outline">{user.organizationName}</Badge>
                ) : null}
                <Badge variant="secondary">{user.role.name}</Badge>
                <StatusBadge status={user.status} label={t(`status.${user.status}`)} />
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <Separator className="mb-3" />
              <p className="text-muted-foreground mb-1 text-xs font-medium">
                {t("permissionsHeading")}
              </p>
              {role ? (
                <ModuleAccessList permissions={role.permissions} />
              ) : (
                <p className="text-muted-foreground text-xs">{t("noResults")}</p>
              )}
            </div>

            {canWrite ? (
              <SheetFooter className="flex-row justify-end gap-2 border-t">
                <DeleteUserAlert
                  user={user}
                  trigger={
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-destructive gap-2">
                        <Trash2 className="size-4" />
                        {t("deleteUser")}
                      </Button>
                    </AlertDialogTrigger>
                  }
                  onDeleted={(id) => {
                    onDeleted(id);
                    onOpenChange(false);
                  }}
                />
                <Button className="gap-2" onClick={onEdit}>
                  <Pencil className="size-4" />
                  {t("editUser")}
                </Button>
              </SheetFooter>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default function UsersSettingsPage() {
  const t = useTranslations("app.settings.users");
  const tOrgs = useTranslations("app.settings.organizations");
  const { session } = useAuth();
  const isCrossEntity = session?.role.crossEntity ?? false;
  const canWrite = usePermission("entityTeam", "write");
  // Bug fix (Aug 13): the Create User button was checking `write` (the
  // Edit-user action) instead of `create` — coincidentally identical for
  // every role that currently holds both, but semantically wrong, and the
  // exact kind of mismatch that silently hides a button a role should
  // actually see.
  const canCreate = usePermission("entityTeam", "create");
  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // Organization filter (Aug 14) — only meaningful for the crossEntity,
  // every-org view (System Reviewer/Center Supervisor); a same-org role only
  // ever sees its own team, so there's nothing to filter there.
  const [orgFilter, setOrgFilter] = useState<string>(ALL);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [detailUser, setDetailUser] = useState<PlatformUser | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (isCrossEntity) {
      // Center Supervisor: every user, across every organization (read-only).
      // Mirror the entity path's guard: a failed fetch resolves to an empty
      // list instead of leaving the table stuck at `null` with an unhandled
      // rejection (listAll fans out per-org, so any one org failing rejects).
      usersService
        .listAll()
        .then(setUsers)
        .catch(() => setUsers([]));
    } else if (session) {
      // NGO Admin etc: only this organization's own team.
      usersService
        .listByOrganization()
        .then((orgUsers) =>
          setUsers(
            orgUsers.map((u) => ({
              ...u,
              organizationId: session.organization.id,
              organizationName: session.organization.name,
            })),
          ),
        )
        .catch(() => setUsers([]));
    }
    // Keep the full role set: it resolves the permissions shown in any
    // user's detail sheet — including cross-entity users (Center Supervisor)
    // who appear in the platform-wide list. Which roles are *assignable* is
    // a separate, narrower concern (see assignableRoles).
    rolesService.list().then(setRoles);
  }, [isCrossEntity, session]);

  // Derived from whatever's actually loaded, id→name so the filter still
  // reads correctly if two orgs happen to share a display name.
  const availableOrganizations = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users ?? []) {
      if (!map.has(user.organizationId))
        map.set(user.organizationId, user.organizationName);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (users ?? []).filter(
      (user) =>
        (orgFilter === ALL || user.organizationId === orgFilter) &&
        (!normalized ||
          user.name.toLowerCase().includes(normalized) ||
          user.email.toLowerCase().includes(normalized) ||
          user.organizationName.toLowerCase().includes(normalized)),
    );
  }, [users, query, orgFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedUsers = filteredUsers.slice(
    (currentPage - 1) * USERS_PAGE_SIZE,
    currentPage * USERS_PAGE_SIZE,
  );

  // Roles a person can actually be self-service assigned by their own
  // entity's admin: must be `enabled`, never Citizen Guest (not an account
  // at all), and never one of the crossEntity roles (System Admin, System
  // Reviewer, Center Supervisor) — the backend's own privilege guard
  // (UsersService: only a crossEntity caller may grant a crossEntity role)
  // already rejects a tenant-scoped admin trying to hand those out, so
  // offering them here would just be a dropdown option that always fails.
  // Center Supervisor is still a real, entity-account-bound role — it's
  // just System Admin who has to be the one granting it (see
  // system-admin/organizations/_components/role-options.ts). Used only for
  // the create/edit dropdowns.
  const assignableRoles = useMemo(
    () =>
      roles.filter(
        (role) => role.enabled && !role.crossEntity && role.key !== "citizen_guest",
      ),
    [roles],
  );

  const detailRole = detailUser
    ? roles.find((role) => role.id === detailUser.role.id)
    : undefined;

  const updateUser = (updated: PlatformUser) => {
    setUsers((prev) => (prev ?? []).map((u) => (u.id === updated.id ? updated : u)));
    setDetailUser((prev) => (prev && prev.id === updated.id ? updated : prev));
  };

  return (
    <PermissionGuard module="entityTeam" action="read">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={isCrossEntity ? tOrgs("usersDescriptionGlobal") : t("description")}
          actions={
            // Not on this page for a crossEntity role (System Admin/Reviewer,
            // Center Supervisor) — this list is platform-wide, every user
            // across every org, so "create a user" has no single org to
            // attach to. System Admin already creates users from inside a
            // specific org's own Users tab (Settings → Organizations → an
            // org → Users → Invite User) — this button would just duplicate
            // that with an extra, redundant org picker.
            !isCrossEntity && canCreate && assignableRoles.length > 0 ? (
              <Button className="gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t("newUser")}
              </Button>
            ) : null
          }
        />

        <Card>
          <CardContent className="p-0">
            <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <div className="relative min-w-0 flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 ps-9"
                />
              </div>
              {isCrossEntity ? (
                <Select
                  value={orgFilter}
                  onValueChange={(v) => {
                    setOrgFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className="h-8 w-full sm:w-56"
                    aria-label={t("filterOrganizationLabel")}
                  >
                    <SelectValue placeholder={t("filterOrganizationLabel")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("filterOrganizationAll")}</SelectItem>
                    {availableOrganizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("nameColumn")}</TableHead>
                  {isCrossEntity ? <TableHead>{tOrgs("nameColumn")}</TableHead> : null}
                  <TableHead>{t("roleColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users === null ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-muted size-9 rounded-full" />
                          <div className="space-y-1.5">
                            <div className="bg-muted h-4 w-24 rounded" />
                            <div className="bg-muted h-3 w-32 rounded" />
                          </div>
                        </div>
                      </TableCell>
                      {isCrossEntity ? (
                        <TableCell>
                          <div className="bg-muted h-5 w-24 rounded" />
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <div className="bg-muted h-5 w-20 rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="bg-muted h-5 w-16 rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isCrossEntity ? 4 : 3}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <User className="size-5" />
                        </div>
                        <p>{t("noResults")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        setDetailUser(user);
                        setDetailOpen(true);
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarFallback className="text-xs font-medium">
                              {initials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-foreground text-sm font-medium">
                              {user.name}
                            </p>
                            <p className="text-muted-foreground text-xs">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      {isCrossEntity ? (
                        <TableCell className="text-muted-foreground">
                          {user.organizationName}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Badge variant="secondary">{user.role.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={user.status}
                          label={t(`status.${user.status}`)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {filteredUsers.length > 0 ? (
              <div className="border-border border-t px-4 py-3">
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  previousLabel={t("pagination.previous")}
                  nextLabel={t("pagination.next")}
                  pageLabel={(p, count) => t("pagination.label", { page: p, count })}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <UserDialog
          roles={assignableRoles}
          currentOrganization={{
            id: session?.organization.id ?? "",
            name: session?.organization.name ?? "",
          }}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={(user) => setUsers((prev) => [...(prev ?? []), user])}
        />

        <UserDialog
          roles={assignableRoles}
          currentOrganization={{
            id: session?.organization.id ?? "",
            name: session?.organization.name ?? "",
          }}
          user={editingUser ?? undefined}
          open={editingUser !== null}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null);
          }}
          onSaved={updateUser}
        />

        <UserDetailSheet
          user={detailUser}
          role={detailRole}
          isCrossEntity={isCrossEntity}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          canWrite={canWrite}
          onEdit={() => {
            if (detailUser) {
              setEditingUser(detailUser);
              setDetailOpen(false);
            }
          }}
          onDeleted={(id) => setUsers((prev) => (prev ?? []).filter((u) => u.id !== id))}
        />
      </PageContainer>
    </PermissionGuard>
  );
}
