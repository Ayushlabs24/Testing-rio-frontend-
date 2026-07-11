"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Search, Trash2, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ModuleAccessList } from "@/components/features/settings/module-access-list";
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
import { organizationsService } from "@/services/organizations/organizations.service";
import type { OrganizationSummary } from "@/services/organizations/organizations.types";
import { rolesService } from "@/services/roles/roles.service";
import type { RoleSummary } from "@/services/roles/roles.types";
import { usersService } from "@/services/users/users.service";
import type { PlatformUser, UserStatus } from "@/services/users/users.types";

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
          ? "bg-success/10 text-success hover:bg-success/20 border-success/20"
          : undefined
      }
    >
      {label}
    </Badge>
  );
}

interface UserDialogProps {
  roles: RoleSummary[];
  organizations: OrganizationSummary[];
  isCrossEntity: boolean;
  user?: PlatformUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: PlatformUser) => void;
}

function UserDialog({
  roles,
  organizations,
  isCrossEntity,
  user,
  open,
  onOpenChange,
  onSaved,
}: UserDialogProps) {
  const t = useTranslations("app.settings.users");
  const tOrgs = useTranslations("app.settings.organizations");
  const tValidation = useTranslations("auth.validation");
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = Boolean(user);

  const schema = z.object({
    name: z.string().min(1, { message: tValidation("nameRequired") }),
    email: z.string().email({ message: tValidation("emailInvalid") }),
    roleId: z.string().min(1, { message: tValidation("roleRequired") }),
    organizationId: isCrossEntity
      ? z.string().min(1, { message: tOrgs("organizationRequired") })
      : z.string().optional(),
    status: z.enum(["active", "invited"]),
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
      organizationId: user?.organizationId ?? "",
      status: user?.status ?? "active",
    },
  });

  const selectedRoleId = useWatch({ control, name: "roleId" });
  const selectedOrganizationId = useWatch({ control, name: "organizationId" });
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
      let saved: PlatformUser;
      if (isEdit) {
        const changes = {
          name: values.name,
          roleId: values.roleId,
          status: values.status,
        };
        // Mirror create/delete: cross-entity roles edit any org via the
        // unscoped path; an entity role stays scoped to its own org so the
        // mock's tenant-isolation checks (requireOrgUser) still apply.
        saved = isCrossEntity
          ? await usersService.updateAny(user!.id, changes)
          : await usersService.update(user!.id, changes).then((updated) => ({
              ...updated,
              organizationId: user!.organizationId,
              organizationName: user!.organizationName,
            }));
      } else if (isCrossEntity) {
        saved = await usersService.createForOrganization({
          organizationId: values.organizationId!,
          name: values.name,
          email: values.email,
          roleId: values.roleId,
        });
      } else {
        // Entity admin: the service resolves the caller's own organization,
        // so the returned PlatformUser already carries its org id/name.
        saved = await usersService.create(values);
      }
      onSaved(saved);
      reset();
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("genericError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editUserTitle") : t("newUserTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 sm:grid-cols-2">
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

            {isCrossEntity ? (
              <div className="space-y-2">
                <Label htmlFor="organizationId">{t("organizationLabel")}</Label>
                <Select
                  value={selectedOrganizationId || undefined}
                  disabled={isEdit}
                  onValueChange={(value) => setValue("organizationId", value)}
                >
                  <SelectTrigger id="organizationId" className="w-full">
                    <SelectValue placeholder={tOrgs("organizationPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((organization) => (
                      <SelectItem key={organization.id} value={organization.id}>
                        {organization.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.organizationId ? (
                  <p className="text-destructive text-sm">
                    {errors.organizationId.message}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="roleId">{t("roleLabel")}</Label>
              <Select
                value={selectedRoleId || undefined}
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
                  value={selectedStatus || undefined}
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit
                  ? t("saving")
                  : t("creating")
                : isEdit
                  ? t("save")
                  : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserAlert({
  user,
  isCrossEntity,
  onDeleted,
  trigger,
}: {
  user: PlatformUser;
  isCrossEntity: boolean;
  onDeleted: (id: string) => void;
  trigger: React.ReactNode;
}) {
  const t = useTranslations("app.settings.users");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    try {
      await (isCrossEntity
        ? usersService.removeAny(user.id)
        : usersService.remove(user.id));
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
                  isCrossEntity={isCrossEntity}
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
  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [detailUser, setDetailUser] = useState<PlatformUser | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (isCrossEntity) {
      // System Admin: every user, across every organization.
      usersService.listAll().then(setUsers);
      organizationsService.listAll().then(setOrganizations);
    } else if (session) {
      // NGO Admin etc: only this organization's own team.
      usersService.listByOrganization().then((orgUsers) =>
        setUsers(
          orgUsers.map((u) => ({
            ...u,
            organizationId: session.organization.id,
            organizationName: session.organization.name,
          })),
        ),
      );
    }
    // Keep the full role set: it resolves the permissions shown in any
    // user's detail sheet — including cross-entity users (System Admin,
    // Center Supervisor) who appear in the platform-wide list. Which roles
    // are *assignable* is a separate, narrower concern (see assignableRoles).
    rolesService.list().then(setRoles);
  }, [isCrossEntity, session]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users ?? [];
    return (users ?? []).filter(
      (user) =>
        user.name.toLowerCase().includes(normalized) ||
        user.email.toLowerCase().includes(normalized) ||
        user.organizationName.toLowerCase().includes(normalized),
    );
  }, [users, query]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedUsers = filteredUsers.slice(
    (currentPage - 1) * USERS_PAGE_SIZE,
    currentPage * USERS_PAGE_SIZE,
  );

  // Roles a person can actually be assigned within an entity: no cross-entity
  // roles (System Admin, Center Supervisor) and no Citizen Guest, which isn't
  // an account at all — see roles.ts. Used only for the create/edit dropdowns.
  const assignableRoles = useMemo(
    () => roles.filter((role) => !role.crossEntity && role.key !== "citizen_guest"),
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
            canWrite && assignableRoles.length > 0 ? (
              <Button className="gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                {t("newUser")}
              </Button>
            ) : null
          }
        />

        <Card>
          <CardContent className="p-0">
            <div className="border-border flex items-center gap-3 border-b px-4 py-3">
              <Search className="text-muted-foreground size-4" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
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
          organizations={organizations}
          isCrossEntity={isCrossEntity}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSaved={(user) => setUsers((prev) => [...(prev ?? []), user])}
        />

        <UserDialog
          roles={assignableRoles}
          organizations={organizations}
          isCrossEntity={isCrossEntity}
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
