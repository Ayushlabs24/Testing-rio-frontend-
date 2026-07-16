"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Mail, MapPin, MessageSquare, Send, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/services/api/types";
import { contactService } from "@/services/contact/contact.service";
import type { OrganizationOption } from "@/services/contact/contact.types";

/**
 * Support enquiry form for the public auth pages, opened from a floating
 * button. Mounted in AuthShell, so it is reachable from every auth page —
 * someone locked out of their account needs this most when they *cannot*
 * sign in.
 *
 * On success the form is replaced by a confirmation rather than closing
 * outright: closing instantly reads as "did that send?". Reopening resets
 * back to the form (see `onOpenChange`).
 */
export function ContactDialog() {
  const t = useTranslations("auth.contact");
  const tValidation = useTranslations("auth.validation");
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationOption[] | null>(null);
  const [orgsFailed, setOrgsFailed] = useState(false);

  const contactSchema = z.object({
    organizationId: z.string().min(1, { message: tValidation("organizationRequired") }),
    name: z.string().min(1, { message: tValidation("nameRequired") }),
    email: z.email({ message: tValidation("emailInvalid") }),
    region: z.string().min(1, { message: tValidation("regionRequired") }),
    purpose: z.string().min(10, { message: tValidation("purposeMin") }),
  });

  type ContactValues = z.infer<typeof contactSchema>;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    // organizationId starts as "" so the Select is controlled from the first
    // render — reset() returns it here rather than to undefined.
    defaultValues: { organizationId: "", name: "", email: "", region: "", purpose: "" },
  });

  // Select is controlled, so the value is driven through useWatch/setValue
  // rather than register. useWatch, not watch(): the latter can't be memoized
  // safely and opts the component out of compilation (see study-form.tsx).
  const organizationId = useWatch({ control, name: "organizationId" });

  // Loaded on first open rather than on mount: this dialog is mounted on every
  // auth page, and most visitors never open it.
  useEffect(() => {
    if (!open || organizations || orgsFailed) return;
    let cancelled = false;
    void (async () => {
      try {
        const orgs = await contactService.listOrganizations();
        if (!cancelled) setOrganizations(orgs);
      } catch {
        // The picker is required, so a failed load blocks the form entirely —
        // surface it inline instead of leaving an empty dropdown.
        if (!cancelled) setOrgsFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizations, orgsFailed]);

  const onSubmit = async (values: ContactValues) => {
    setFormError(null);
    try {
      await contactService.submit(values);
      setSentTo(values.email);
      reset();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t("genericError"));
    }
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    // Reset only once closed, so the success state doesn't flicker back to an
    // empty form during the close animation.
    if (!next) {
      setSentTo(null);
      setFormError(null);
      // Cleared so reopening retries the org load; the list itself is kept,
      // since it doesn't change between opens.
      setOrgsFailed(false);
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="fixed right-4 bottom-4 z-40 h-11 gap-2 rounded-full px-4 shadow-lg sm:right-6 sm:bottom-6"
        >
          <MessageSquare className="size-4" />
          <span className="sr-only sm:not-sr-only">{t("triggerLabel")}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          {sentTo ? null : <DialogDescription>{t("description")}</DialogDescription>}
        </DialogHeader>

        {sentTo ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="text-primary size-10" />
            <p className="text-foreground text-base font-medium">{t("successTitle")}</p>
            <p className="text-muted-foreground text-sm">
              {t("successBody", { email: sentTo })}
            </p>
            <DialogClose asChild>
              <Button variant="outline" className="mt-2">
                {t("successClose")}
              </Button>
            </DialogClose>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-organization">{t("organizationLabel")}</Label>
              <Select
                value={organizationId ?? ""}
                onValueChange={(value) =>
                  setValue("organizationId", value, { shouldValidate: true })
                }
                disabled={!organizations}
              >
                <SelectTrigger
                  id="contact-organization"
                  className="h-11 w-full text-base"
                >
                  <SelectValue
                    placeholder={
                      orgsFailed
                        ? t("organizationsError")
                        : organizations
                          ? t("organizationPlaceholder")
                          : t("organizationLoading")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(organizations ?? []).map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {orgsFailed ? (
                <p className="text-destructive text-sm">{t("organizationsError")}</p>
              ) : null}
              {errors.organizationId ? (
                <p className="text-destructive text-sm">
                  {errors.organizationId.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-name">{t("nameLabel")}</Label>
              <div className="relative">
                <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                <Input
                  id="contact-name"
                  placeholder={t("namePlaceholder")}
                  className="h-11 pr-4 pl-10 text-base"
                  {...register("name")}
                />
              </div>
              {errors.name ? (
                <p className="text-destructive text-sm">{errors.name.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email">{t("emailLabel")}</Label>
              <div className="relative">
                <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                <Input
                  id="contact-email"
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  className="h-11 pr-4 pl-10 text-base"
                  {...register("email")}
                />
              </div>
              {errors.email ? (
                <p className="text-destructive text-sm">{errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-region">{t("regionLabel")}</Label>
              <div className="relative">
                <MapPin className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
                <Input
                  id="contact-region"
                  placeholder={t("regionPlaceholder")}
                  className="h-11 pr-4 pl-10 text-base"
                  {...register("region")}
                />
              </div>
              {errors.region ? (
                <p className="text-destructive text-sm">{errors.region.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-purpose">{t("purposeLabel")}</Label>
              <Textarea
                id="contact-purpose"
                rows={4}
                placeholder={t("purposePlaceholder")}
                className="px-4 py-3 text-base"
                {...register("purpose")}
              />
              {errors.purpose ? (
                <p className="text-destructive text-sm">{errors.purpose.message}</p>
              ) : null}
            </div>

            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  {t("cancel")}
                </Button>
              </DialogClose>
              <Button type="submit" className="gap-2" disabled={isSubmitting}>
                {isSubmitting ? t("submitting") : t("submit")}
                {!isSubmitting && <Send className="size-4" />}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
