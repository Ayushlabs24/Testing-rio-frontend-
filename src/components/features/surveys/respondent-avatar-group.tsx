import { useTranslations } from "next-intl";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

export interface RespondentAvatarInfo {
  id: string;
  /** Display name — contact name if the respondent gave one, otherwise
   * their contact (email). Always something to derive initials from. */
  name: string;
  /** No respondent-image source exists anywhere in the citizen flow today
   * (contact is an email, not a profile) — this is here so the group is
   * ready the moment one does, without a future rewrite. */
  imageUrl?: string | null;
}

// Rotating through the design system's own paired (background, readable
// foreground) tokens — same ones already used for badges/icon chips
// elsewhere — rather than inventing new colors, so a row of initials reads
// as distinct people (closer to how LinkedIn's avatar stack looks) instead
// of one flat `bg-muted` blob repeated for everyone.
const AVATAR_PALETTE = [
  "bg-primary text-primary-foreground",
  "bg-badge-success text-badge-success-foreground",
  "bg-badge-warning text-badge-warning-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-accent text-accent-foreground",
];

function paletteClassFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/** Recent respondents, as a stacked row of avatars (photo if one exists,
 * initials otherwise) with a "+N more" tail once the list is longer than
 * `max`. */
export function RespondentAvatarGroup({
  respondents,
  max = 6,
}: {
  respondents: RespondentAvatarInfo[];
  max?: number;
}) {
  const t = useTranslations("app.publicSurveys.responseSummary");
  const shown = respondents.slice(0, max);
  const remaining = respondents.length - shown.length;

  if (respondents.length === 0) return null;

  return (
    <AvatarGroup>
      {shown.map((respondent) => (
        <Avatar key={respondent.id} title={respondent.name}>
          {respondent.imageUrl ? <AvatarImage src={respondent.imageUrl} alt="" /> : null}
          <AvatarFallback className={paletteClassFor(respondent.id)}>
            {initials(respondent.name)}
          </AvatarFallback>
        </Avatar>
      ))}
      {remaining > 0 ? (
        <AvatarGroupCount>{t("moreRespondents", { count: remaining })}</AvatarGroupCount>
      ) : null}
    </AvatarGroup>
  );
}
