import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  BackupKind,
  BackupRecoverability,
  BackupRunPage,
  BackupSummary,
  BackupVerifyResult,
} from "@/services/backups/backups.types";

/**
 * RIO-NFR-010 — backup administration client.
 *
 * Everything here is platform-scoped: a dump contains every entity's rows, so
 * there is no org parameter to pass and no org filter to offer.
 */
export const backupsService = {
  async list(
    params: { kind?: BackupKind; status?: string; page?: number; pageSize?: number },
    signal?: AbortSignal,
  ): Promise<BackupRunPage> {
    return apiClient.get<BackupRunPage>(endpoints.backups.list, {
      params: { ...params },
      signal,
    });
  },

  async summary(signal?: AbortSignal): Promise<BackupSummary> {
    return apiClient.get<BackupSummary>(endpoints.backups.summary, { signal });
  },

  /** Start a backup now. Consumes disk and CPU on a live system. */
  async run(
    kind: BackupKind,
  ): Promise<{ runId?: string; success: boolean; error?: string }> {
    return apiClient.post(endpoints.backups.run, { kind });
  },

  /**
   * Re-checksum a stored artefact against what was recorded when it was
   * written. A read, despite being a POST: it changes nothing.
   */
  async verify(runId: string): Promise<BackupVerifyResult> {
    return apiClient.post<BackupVerifyResult>(endpoints.backups.verify(runId));
  },

  /**
   * Open the artefact and check it could actually be restored — the dump's
   * table of contents, or the archive's manifest, depending on the kind.
   * Slower than `verify` and worth it: it catches the backup that was never
   * usable, which is the one a checksum will happily call intact.
   */
  async checkRecoverability(runId: string): Promise<BackupRecoverability> {
    return apiClient.post<BackupRecoverability>(endpoints.backups.recoverability(runId));
  },

  /** Delete files past their retention date. Never the newest successful run. */
  async prune(): Promise<{ pruned: number; keptNewest: number }> {
    return apiClient.post(endpoints.backups.prune);
  },
};
