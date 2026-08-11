import type {
  SystemLogCategory,
  SystemLogFilters,
  SystemLogLevel,
} from "@/services/system-logs/system-logs.types";

/** Sentinel for "no filter" — Radix Select has no empty-string value. */
export const ALL = "all";
/** The triage shortcut: warn + error + fatal in one click. */
export const WARN_AND_ABOVE = "warn+";

/** The raw shape of the filter bar, before it becomes an API query. */
export type SystemLogFilterSelection = {
  levelFilter: string;
  category: string;
  organizationId: string;
  eventCode: string | null;
  search: string;
};

/**
 * Single source of truth for turning the filter bar into API params. Shared
 * by the table and the export dialog so an export can never be built from a
 * different rule set than the rows on screen.
 */
export function buildSystemLogFilters({
  levelFilter,
  category,
  organizationId,
  eventCode,
  search,
}: SystemLogFilterSelection): SystemLogFilters {
  const f: SystemLogFilters = {};
  if (levelFilter === WARN_AND_ABOVE) f.minLevel = "warn";
  else if (levelFilter !== ALL) f.level = levelFilter as SystemLogLevel;
  if (category !== ALL) f.category = category as SystemLogCategory;
  if (organizationId !== ALL) f.organizationId = organizationId;
  if (eventCode) f.eventCode = eventCode;
  if (search.trim()) f.search = search.trim();
  return f;
}
