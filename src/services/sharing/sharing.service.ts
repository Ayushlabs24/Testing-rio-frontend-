import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type {
  CreateSharingRequestPayload,
  DecideSharingRequestPayload,
  OrgLookupResult,
  SharedStudySnapshot,
  SharingRequest,
  StudyLookupResult,
} from "@/services/sharing/sharing.types";

export const sharingService = {
  async create(payload: CreateSharingRequestPayload): Promise<SharingRequest> {
    return apiClient.post<SharingRequest>(endpoints.sharing.create, payload);
  },
  async list(): Promise<SharingRequest[]> {
    return apiClient.get<SharingRequest[]>(endpoints.sharing.list);
  },
  async getById(id: string): Promise<SharingRequest> {
    return apiClient.get<SharingRequest>(endpoints.sharing.byId(id));
  },
  async approve(
    id: string,
    payload: DecideSharingRequestPayload = {},
  ): Promise<SharingRequest> {
    return apiClient.patch<SharingRequest>(endpoints.sharing.approve(id), payload);
  },
  async reject(
    id: string,
    payload: DecideSharingRequestPayload = {},
  ): Promise<SharingRequest> {
    return apiClient.patch<SharingRequest>(endpoints.sharing.reject(id), payload);
  },
  async getSharedStudy(id: string): Promise<SharedStudySnapshot> {
    return apiClient.get<SharedStudySnapshot>(endpoints.sharing.sharedStudy(id));
  },
  async lookupOrganizations(query: string): Promise<OrgLookupResult[]> {
    return apiClient.get<OrgLookupResult[]>(endpoints.sharing.lookupOrganizations(query));
  },
  async lookupStudiesForOrg(orgId: string): Promise<StudyLookupResult[]> {
    return apiClient.get<StudyLookupResult[]>(
      endpoints.sharing.lookupStudiesForOrg(orgId),
    );
  },
};
