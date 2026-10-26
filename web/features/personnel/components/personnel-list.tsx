"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { AssetLookup } from "@/features/assets/components/asset-lookup";
import type { AssetChoice } from "@/features/assets/types/asset";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { Select } from "@/shared/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { getPersonnel } from "../personnel.api";
import { personnelError } from "../personnel.logic";
import {
  ROLE_LABELS,
  type PersonnelFilters,
  type PersonnelSummary,
} from "../types";
import { CustomerList } from "./customer-list";
import { PersonnelCreate } from "./personnel-create";

export function PersonnelList({
  farmId,
  roles,
}: {
  farmId: string;
  roles: string[];
}) {
  const request = useAuthenticatedRequest();
  const [filters, setFilters] = useState<PersonnelFilters>({
    page: 1,
    pageSize: 20,
  });
  const [warehouse, setWarehouse] = useState<AssetChoice | null>(null);
  const [result, setResult] = useState<{
    filters: PersonnelFilters;
    response?: PaginatedResponse<PersonnelSummary>;
    error?: string;
  } | null>(null);
  const [create, setCreate] = useState(false);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [tab, setTab] = useState<"internal" | "customers">("internal");
  useEffect(() => {
    let cancelled = false;
    void getPersonnel(request, farmId, filters)
      .then((response) => {
        if (cancelled) return;
        if (filters.page > Math.max(1, response.page.totalPages)) {
          setFilters({
            ...filters,
            page: Math.max(1, response.page.totalPages),
          });
          return;
        }
        setResult({ filters, response });
      })
      .catch((error) => {
        if (!cancelled)
          setResult({ filters, error: personnelError(error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, filters]);
  const current = result?.filters === filters ? result : null;
  const change = (patch: Partial<PersonnelFilters>) =>
    setFilters({ ...filters, ...patch, page: 1 });
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Nhân sự"
        description="Quản lý nhân sự nội bộ và tài khoản khách đã đăng nhập."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setFilters({ ...filters })}
            >
              Tải lại
            </Button>
            <Button ref={createTrigger} onClick={() => setCreate(true)}>
              Thêm nhân sự
            </Button>
          </>
        }
      />
      {created && (
        <p role="status" className="rounded border bg-muted p-3 text-sm">
          Đã thêm nhân sự.{" "}
          <Link className="underline" href={`/personnel/${created}`}>
            Xem hồ sơ
          </Link>
        </p>
      )}
      <div role="tablist" aria-label="Loại tài khoản" className="flex gap-2">
        {(
          [
            ["internal", "Nội bộ"],
            ["customers", "Khách hàng"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            role="tab"
            aria-selected={tab === value}
            variant={tab === value ? "default" : "outline"}
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === "customers" ? (
        <CustomerList
          farmId={farmId}
          roles={roles}
          onPromoted={(memberId) => {
            setTab("internal");
            setCreated(memberId);
            setFilters({ ...filters });
          }}
        />
      ) : (
        <>
          <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span>Tìm nhân sự</span>
              <Input
                type="search"
                value={filters.search ?? ""}
                placeholder="Tên, email hoặc mã nhân viên"
                onChange={(event) => change({ search: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Trạng thái thành viên</span>
              <Select
                value={filters.status ?? ""}
                onChange={(event) =>
                  change({ status: event.target.value || undefined })
                }
              >
                <option value="">Tất cả</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
              </Select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Quyền trong trại</span>
              <Select
                value={filters.role ?? ""}
                onChange={(event) =>
                  change({ role: event.target.value || undefined })
                }
              >
                <option value="">Tất cả quyền</option>
                {Object.entries(ROLE_LABELS).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </Select>
            </label>
            <AssetLookup
              farmId={farmId}
              kind="warehouse"
              selected={warehouse}
              onSelect={(choice) => {
                setWarehouse(choice);
                change({ warehouseId: choice?.id });
              }}
            />
          </div>
          {!current && <p role="status">Đang tải nhân sự…</p>}
          {current?.error && (
            <ErrorAlert
              message={current.error}
              onRetry={() => setFilters({ ...filters })}
            />
          )}
          {current?.response && (
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table className="min-w-[780px]">
                <TableHeader>
                  <TableRow>
                    {[
                      "Họ tên / Email",
                      "Mã / Chức danh",
                      "Quyền",
                      "Nơi làm việc",
                      "Trạng thái",
                    ].map((title) => (
                      <TableHead key={title}>{title}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {current.response.data.map((member) => (
                    <TableRow key={member.memberId}>
                      <TableCell>
                        <Link
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          href={`/personnel/${member.memberId}`}
                        >
                          {member.fullName || member.email}
                        </Link>
                        <p className="break-all text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      </TableCell>
                      <TableCell>
                        {member.employeeCode || "—"}
                        <p className="text-xs text-muted-foreground">
                          {member.jobTitle || "Chưa có chức danh"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {member.roleCodes
                          .map((code) => ROLE_LABELS[code] ?? code)
                          .join(", ") || "Chưa có quyền"}
                      </TableCell>
                      <TableCell>
                        {member.warehouses
                          .map(
                            (w) =>
                              `${w.name}${w.status === "INACTIVE" ? " (ngừng hoạt động)" : ""}`,
                          )
                          .join(", ") || "Chưa gán kho"}
                      </TableCell>
                      <TableCell>
                        {member.membershipStatus === "ACTIVE"
                          ? "Đang hoạt động"
                          : "Ngừng hoạt động"}
                        {member.accountStatus === "INACTIVE" && (
                          <p className="text-destructive">Tài khoản bị khóa</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!current.response.data.length && (
                    <TableRow>
                      <TableCell colSpan={5}>
                        Không có nhân sự phù hợp với bộ lọc.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <Pagination
                pageInfo={current.response.page}
                itemLabel="nhân sự"
                onPageChange={(page) => setFilters({ ...filters, page })}
              />
            </div>
          )}
        </>
      )}
      {create && (
        <PersonnelCreate
          farmId={farmId}
          canAssignOwner={roles.includes("ADMIN")}
          onClose={() => setCreate(false)}
          onCloseFocus={() => createTrigger.current?.focus()}
          onCreated={(member) => {
            setCreate(false);
            setCreated(member.memberId);
            setFilters({ ...filters });
          }}
        />
      )}
    </div>
  );
}
