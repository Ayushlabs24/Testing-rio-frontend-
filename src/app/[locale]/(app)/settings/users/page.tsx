"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Search, Trash2, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { usePermission } from "@/hooks/use-permission";
import { rolesService } from "@/services/roles/roles.service";
import type { RoleSummary } from "@/services/roles/roles.types";
import { usersService } from "@/services/users/users.service";
import type { OrgUser, UserStatus } from "@/services/users/users.types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface UserDialogProps {
  roles: RoleSummary[];
  user?: OrgUser;
  trigger: React.ReactNode;
  onSaved: (user: OrgUser) => void;
}

function UserDialog({ roles, user, trigger, onSaved }: UserDialogProps) {
  const t = useTranslations("app.settings.users");
  const tModules = useTranslations("app.settings.roles.modules");
  const tValidation = useTranslations("auth.validation");
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = Boolean(user);

  const schema = z.object({
    name: z.string().min(1, { message: tValidation("nameRequired") }),
    email: z.string().email({ message: tValidation("emailInvalid") }),
    roleId: z.string().min(1, { message: tValidation("roleRequired") }),
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
      status: user?.status ?? "active",
    },
  });

  const selectedRoleId = useWatch({ control, name: "roleId" });
  const selectedStatus = useWatch({ control, name: "status" });
  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  const onSubmit = async (values: Values) => {
    setFormError(null);
    try {
      const saved = isEdit
        ? await usersService.update(user!.id, {
            name: values.name,
            roleId: values.roleId,
            status: values.status,
          })
        : await usersService.create(values);
      onSaved(saved);
      reset();
      setOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("genericError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editUserTitle") : t("newUserTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              value={selectedRoleId || undefined}
              onValueChange={(value) => setValue("roleId", value)}
            >
              <SelectTrigger id="roleId" className="w-full">
                <SelectValue placeholder={t("rolePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
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

          {selectedRole ? (
            <div className="border-border rounded-md border p-3">
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                {t("derivedPermissions")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedRole.permissions
                  .filter((permission) => permission.read || permission.write)
                  .map((permission) => (
                    <Badge key={permission.module} variant="secondary">
                      {tModules(permission.module)}
                      {permission.write ? ` (${t("write")})` : ` (${t("read")})`}
                    </Badge>
                  ))}
              </div>
            </div>
          ) : null}

          {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

          <DialogFooter>
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
  onDeleted,
  trigger,
}: {
  user: OrgUser;
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

export default function UsersSettingsPage() {
  const t = useTranslations("app.settings.users");
  const canWrite = usePermission("usersRoles", "write");
  const [users, setUsers] = useState<OrgUser[] | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    usersService.listByOrganization().then(setUsers);
    rolesService.list().then(setRoles);
  }, []);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users ?? [];
    return (users ?? []).filter(
      (user) =>
        user.name.toLowerCase().includes(normalized) ||
        user.email.toLowerCase().includes(normalized),
    );
  }, [users, query]);

  return (
    <PermissionGuard module="usersRoles" action="read">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            canWrite && roles.length > 0 ? (
              <UserDialog
                roles={roles}
                trigger={
                  <Button className="gap-2">
                    <Plus className="size-4" />
                    {t("newUser")}
                  </Button>
                }
                onSaved={(user) => setUsers((prev) => [...(prev ?? []), user])}
              />
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
                onChange={(event) => setQuery(event.target.value)}
                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("nameColumn")}</TableHead>
                  <TableHead>{t("roleColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  {canWrite ? <TableHead className="w-24" /> : null}
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
                      <TableCell>
                        <div className="bg-muted h-5 w-20 rounded" />
                      </TableCell>
                      <TableCell>
                        <div className="bg-muted h-5 w-16 rounded" />
                      </TableCell>
                      {canWrite ? (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <div className="bg-muted size-8 rounded" />
                            <div className="bg-muted size-8 rounded" />
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={canWrite ? 4 : 3}
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
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
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
                            <p className="text-muted-foreground text-xs">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{user.role.name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.status === "active" ? "default" : "outline"}
                          className={
                            user.status === "active"
                              ? "bg-success/10 text-success hover:bg-success/20 border-success/20"
                              : undefined
                          }
                        >
                          {t(`status.${user.status}`)}
                        </Badge>
                      </TableCell>
                      {canWrite ? (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <UserDialog
                              roles={roles}
                              user={user}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={t("editUser")}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              }
                              onSaved={(updated) =>
                                setUsers((prev) =>
                                  (prev ?? []).map((u) =>
                                    u.id === updated.id ? updated : u,
                                  ),
                                )
                              }
                            />
                            <DeleteUserAlert
                              user={user}
                              trigger={
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={t("deleteUser")}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </AlertDialogTrigger>
                              }
                              onDeleted={(id) =>
                                setUsers((prev) =>
                                  (prev ?? []).filter((u) => u.id !== id),
                                )
                              }
                            />
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
