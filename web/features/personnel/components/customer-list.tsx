"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { Pagination } from "@/shared/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { getCustomers } from "../personnel.api";
import { personnelError } from "../personnel.logic";
import type { CustomerAccount } from "../types";
import { PersonnelCreate } from "./personnel-create";

type Filters = { page: number; pageSize: number; search?: string };

export function CustomerList({
  farmId,
  roles,
  onPromoted,
}: {
  farmId: string;
  roles: string[];
  onPromoted: (memberId: string) => void;
}) {
  const request = useAuthenticatedRequest();
  const [filters, setFilters] = useState<Filters>({ page: 1, pageSize: 20 });
  const [result, setResult] = useState<{
    filters: Filters;
    response?: PaginatedResponse<CustomerAccount>;
    error?: string;
  } | null>(null);
  const [promote, setPromote] = useState<string | null>(null);
  const promoteTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getCustomers(request, farmId, filters)
      .then((response) => {
        if (!cancelled) setResult({ filters, response });
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
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="min-w-0 flex-1 space-y-1 text-sm">
          <span>Tìm khách hàng</span>
          <Input
            type="search"
            value={filters.search ?? ""}
            placeholder="Tên hoặc email"
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value, page: 1 })
            }
          />
        </label>
        <Button variant="outline" onClick={() => setFilters({ ...filters })}>
          Tải lại
        </Button>
      </div>
      {!current && <p role="status">Đang tải khách hàng…</p>}
      {current?.error && (
        <ErrorAlert
          message={current.error}
          onRetry={() => setFilters({ ...filters })}
        />
      )}
      {current?.response && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                {["Họ tên / Email", "Đăng ký lúc", "Trạng thái", ""].map(
                  (title) => (
                    <TableHead key={title}>{title}</TableHead>
                  ),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {current.response.data.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <p className="font-medium">
                      {customer.fullName || customer.email}
                    </p>
                    <p className="break-all text-xs text-muted-foreground">
                      {customer.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    {new Date(customer.createdAt).toLocaleString("vi-VN")}
                  </TableCell>
                  <TableCell>
                    {customer.accountStatus === "ACTIVE" ? (
                      "Đang hoạt động"
                    ) : (
                      <span className="text-destructive">
                        Tài khoản bị khóa
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={customer.accountStatus !== "ACTIVE"}
                      onClick={(event) => {
                        promoteTrigger.current = event.currentTarget;
                        setPromote(customer.email);
                      }}
                    >
                      Thêm vào nội bộ
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!current.response.data.length && (
                <TableRow>
                  <TableCell colSpan={4}>Chưa có khách hàng phù hợp.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            pageInfo={current.response.page}
            itemLabel="khách hàng"
            onPageChange={(page) => setFilters({ ...filters, page })}
          />
        </div>
      )}
      {promote && (
        <PersonnelCreate
          farmId={farmId}
          canAssignOwner={roles.includes("ADMIN")}
          initialEmail={promote}
          onClose={() => setPromote(null)}
          onCloseFocus={() => promoteTrigger.current?.focus()}
          onCreated={(member) => {
            setPromote(null);
            onPromoted(member.memberId);
          }}
        />
      )}
    </div>
  );
}
