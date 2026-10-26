import type { AuthenticatedRequest } from "@/features/warehouses/api/warehouses.api";
import type { PaginatedResponse } from "@/shared/api/contracts";
import type {
  CreatePersonnelInput,
  CustomerAccount,
  PersonnelDetail,
  PersonnelFilters,
  PersonnelSummary,
} from "./types";

export function getPersonnel(
  request: AuthenticatedRequest,
  farmId: string,
  filters: PersonnelFilters,
) {
  return request<PaginatedResponse<PersonnelSummary>>("/personnel", {
    params: { ...filters, search: filters.search?.trim() || undefined, farmId },
  });
}

export function getCustomers(
  request: AuthenticatedRequest,
  farmId: string,
  filters: { page: number; pageSize: number; search?: string },
) {
  return request<PaginatedResponse<CustomerAccount>>("/personnel/customers", {
    params: { ...filters, search: filters.search?.trim() || undefined, farmId },
  });
}

export function getMember(
  request: AuthenticatedRequest,
  farmId: string,
  memberId: string,
) {
  return request<{ data: PersonnelDetail }>(
    `/personnel/${encodeURIComponent(memberId)}`,
    { params: { farmId } },
  );
}

export function createPersonnel(
  request: AuthenticatedRequest,
  farmId: string,
  input: CreatePersonnelInput,
) {
  return request<
    { data: PersonnelDetail } | { requestId: string; status: string }
  >("/personnel/accounts", { method: "POST", params: { farmId }, data: input });
}

export function addExistingPersonnel(
  request: AuthenticatedRequest,
  farmId: string,
  input: Omit<
    CreatePersonnelInput,
    "requestId" | "fullName" | "initialPassword"
  >,
) {
  return request<{ data: PersonnelDetail }>("/personnel/existing-accounts", {
    method: "POST",
    params: { farmId },
    data: input,
  });
}

export function updateMember(
  request: AuthenticatedRequest,
  farmId: string,
  memberId: string,
  operation: "profile" | "roles" | "warehouses" | "status",
  input: object,
) {
  const suffix = operation === "profile" ? "" : `/${operation}`;
  return request<{ data: PersonnelDetail }>(
    `/personnel/${encodeURIComponent(memberId)}${suffix}`,
    {
      method:
        operation === "roles" || operation === "warehouses" ? "PUT" : "PATCH",
      params: { farmId },
      data: input,
    },
  );
}

export function getMemberRecords<T>(
  request: AuthenticatedRequest,
  farmId: string,
  memberId: string,
  kind: "assets" | "history",
  page: number,
) {
  return request<PaginatedResponse<T>>(
    `/personnel/${encodeURIComponent(memberId)}/${kind}`,
    { params: { farmId, page, pageSize: 10 } },
  );
}
