"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { getMember, getMemberRecords } from "../personnel.api";
import { canEditMember, personnelError } from "../personnel.logic";
import {
  ROLE_LABELS,
  type HeldAsset,
  type PersonnelDetail,
  type PersonnelHistory,
} from "../types";
import { PersonnelEdit, type PersonnelEditKind } from "./personnel-edit";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

export function PersonnelDetailView({
  farmId,
  farmName,
  memberId,
  actorMemberId,
  roles,
}: {
  farmId: string;
  farmName: string;
  memberId: string;
  actorMemberId: string;
  roles: string[];
}) {
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    member?: PersonnelDetail;
    error?: string;
  } | null>(null);
  const [edit, setEdit] = useState<PersonnelEditKind | null>(null);
  const editTrigger = useRef<HTMLButtonElement>(null);
  const refreshTrigger = useRef<HTMLButtonElement>(null);
  const openEdit = (kind: PersonnelEditKind, trigger: HTMLButtonElement) => {
    editTrigger.current = trigger;
    setEdit(kind);
  };
  useEffect(() => {
    let cancelled = false;
    void getMember(request, farmId, memberId)
      .then(({ data }) => {
        if (!cancelled) setResult({ attempt, member: data });
      })
      .catch((error) => {
        if (!cancelled)
          setResult({ attempt, error: personnelError(error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, memberId, attempt]);
  const current = result?.attempt === attempt ? result : null;
  const member = current?.member;
  const reload = () => {
    setEdit(null);
    setAttempt((value) => value + 1);
  };
  const canEdit = member && canEditMember(roles, member.roleCodes);
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary underline" href="/personnel">
        ← Danh sách nhân sự
      </Link>
      <PageHeader
        title={member?.fullName || "Hồ sơ nhân sự"}
        description={farmName}
        actions={
          <Button ref={refreshTrigger} variant="outline" onClick={reload}>
            Tải lại
          </Button>
        }
      />
      {!current && <BeeLoader label="Đang tải hồ sơ…" />}
      {current?.error && (
        <ErrorAlert message={current.error} onRetry={reload} />
      )}
      {member && (
        <>
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Thông tin công việc</h2>
            <p className="break-all text-sm">{member.email}</p>
            <p className="text-xs text-muted-foreground">
              Tên và email dùng chung giữa các trại. Nhân viên tự quản lý thông
              tin tài khoản qua Clerk.
            </p>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              {[
                ["Mã nhân viên", member.employeeCode],
                ["Chức danh", member.jobTitle],
                ["Điện thoại tại trại", member.phone],
                [
                  "Ngày tham gia",
                  new Date(member.joinedAt).toLocaleDateString("vi-VN"),
                ],
                [
                  "Trạng thái thành viên",
                  member.membershipStatus === "ACTIVE"
                    ? "Đang hoạt động"
                    : "Ngừng hoạt động",
                ],
                [
                  "Trạng thái tài khoản",
                  member.accountStatus === "ACTIVE"
                    ? "Đang hoạt động"
                    : "Đã khóa",
                ],
                ["Ghi chú", member.note],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words">
                    {value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
            {canEdit && (
              <Button
                variant="outline"
                onClick={(event) => openEdit("profile", event.currentTarget)}
              >
                Sửa hồ sơ công việc
              </Button>
            )}
          </section>
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Quyền và nơi làm việc</h2>
            <p className="text-sm">
              {member.roleCodes
                .map((role) => ROLE_LABELS[role] ?? role)
                .join(", ") || "Chưa có quyền"}
            </p>
            <ul className="space-y-1 text-sm">
              {member.warehouses.map((w) => (
                <li key={w.id}>
                  {w.code} — {w.name}
                  {w.status === "INACTIVE" && " (ngừng hoạt động)"}
                </li>
              ))}
            </ul>
            {!member.warehouses.length && (
              <p className="text-sm text-muted-foreground">
                Chưa gán kho làm việc.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Nơi làm việc không giới hạn dữ liệu theo từng kho. Quyền truy cập
              vẫn theo trại.
            </p>
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={actorMemberId === member.memberId}
                  onClick={(event) => openEdit("roles", event.currentTarget)}
                >
                  Đổi quyền
                </Button>
                <Button
                  variant="outline"
                  onClick={(event) =>
                    openEdit("warehouses", event.currentTarget)
                  }
                >
                  Gán kho
                </Button>
                <Button
                  variant={
                    member.membershipStatus === "ACTIVE"
                      ? "destructive"
                      : "outline"
                  }
                  disabled={actorMemberId === member.memberId}
                  onClick={(event) => openEdit("status", event.currentTarget)}
                >
                  {member.membershipStatus === "ACTIVE"
                    ? "Ngừng hoạt động"
                    : "Kích hoạt lại"}
                </Button>
              </div>
            )}
            {actorMemberId === member.memberId && (
              <p className="text-xs text-muted-foreground">
                Bạn không thể thay đổi quyền hoặc trạng thái thành viên của
                chính mình.
              </p>
            )}
          </section>
          <PersonnelRecords
            key={`assets:${attempt}`}
            farmId={farmId}
            memberId={memberId}
            kind="assets"
          />
          <PersonnelRecords
            key={`history:${attempt}`}
            farmId={farmId}
            memberId={memberId}
            kind="history"
          />
          {edit && (
            <PersonnelEdit
              member={member}
              farmId={farmId}
              farmName={farmName}
              kind={edit}
              canAssignOwner={roles.includes("ADMIN")}
              onClose={() => setEdit(null)}
              onCloseFocus={() => {
                const trigger = editTrigger.current;
                if (trigger?.isConnected && !trigger.disabled) trigger.focus();
                else refreshTrigger.current?.focus();
              }}
              onSaved={reload}
            />
          )}
        </>
      )}
    </div>
  );
}

function PersonnelRecords({
  farmId,
  memberId,
  kind,
}: {
  farmId: string;
  memberId: string;
  kind: "assets" | "history";
}) {
  const request = useAuthenticatedRequest();
  const [query, setQuery] = useState({ page: 1 });
  const [result, setResult] = useState<{
    query: typeof query;
    response?: PaginatedResponse<HeldAsset | PersonnelHistory>;
    error?: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getMemberRecords<HeldAsset | PersonnelHistory>(
      request,
      farmId,
      memberId,
      kind,
      query.page,
    )
      .then((response) => {
        if (cancelled) return;
        if (query.page > Math.max(1, response.page.totalPages)) {
          setQuery({ page: Math.max(1, response.page.totalPages) });
          return;
        }
        setResult({ query, response });
      })
      .catch((error) => {
        if (!cancelled)
          setResult({ query, error: personnelError(error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, memberId, kind, query]);
  const current = result?.query === query ? result : null;
  const actionLabels: Record<string, string> = {
    PERSONNEL_ADDED: "Thêm nhân sự",
    PERSONNEL_PROFILE_CHANGED: "Cập nhật hồ sơ công việc",
    PERSONNEL_ROLES_CHANGED: "Thay đổi quyền",
    PERSONNEL_WORKPLACES_CHANGED: "Thay đổi nơi làm việc",
    PERSONNEL_STATUS_CHANGED: "Thay đổi trạng thái",
  };
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <h2 className="p-5 font-semibold">
        {kind === "assets" ? "Tài sản đang giữ" : "Lịch sử thay đổi"}
      </h2>
      {kind === "assets" && (
        <p className="px-5 pb-4 text-sm text-muted-foreground">
          Mở tài sản để xử lý trả hoặc bàn giao. Ngừng hoạt động nhân sự không
          tự thay đổi tồn kho.
        </p>
      )}
      {!current && (
        <BeeLoader label="Đang tải…" size="sm" />
      )}
      {current?.error && (
        <ErrorAlert
          message={current.error}
          onRetry={() => setQuery({ ...query })}
        />
      )}
      {current?.response && (
        <>
          <ul className="divide-y">
            {current.response.data.map((row) => (
              <li key={row.id} className="space-y-1 px-5 py-3 text-sm">
                {"assetCode" in row ? (
                  <>
                    <Link
                      className="font-medium text-primary underline"
                      href={`/assets/${row.id}`}
                    >
                      {row.assetCode} — {row.itemName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Nhận ngày{" "}
                      {new Date(row.assignedAt).toLocaleDateString("vi-VN")}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">
                      {actionLabels[row.action] ?? "Cập nhật nhân sự"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.actorName || row.actorEmail || "Hệ thống"} ·{" "}
                      {new Date(row.createdAt).toLocaleString("vi-VN")}
                    </p>
                    <HistoryChanges before={row.oldData} after={row.newData} />
                  </>
                )}
              </li>
            ))}
          </ul>
          {!current.response.data.length && (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              {kind === "assets"
                ? "Không có tài sản đang giữ."
                : "Chưa có lịch sử thay đổi."}
            </p>
          )}
          <Pagination
            pageInfo={current.response.page}
            onPageChange={(page) => setQuery({ page })}
          />
        </>
      )}
    </section>
  );
}

function HistoryChanges({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}) {
  const oldData =
    before && typeof before === "object"
      ? (before as Record<string, unknown>)
      : {};
  const newData =
    after && typeof after === "object"
      ? (after as Record<string, unknown>)
      : {};
  const fields: Record<string, string> = {
    employeeCode: "Mã nhân viên",
    jobTitle: "Chức danh",
    phone: "Điện thoại",
    note: "Ghi chú",
    roleCodes: "Quyền",
    membershipStatus: "Trạng thái",
    warehouseIds: "Số nơi làm việc",
    reason: "Lý do",
  };
  function format(key: string, value: unknown) {
    if (key === "warehouseIds" && Array.isArray(value))
      return String(value.length);
    if (key === "roleCodes" && Array.isArray(value))
      return value.map((code: string) => ROLE_LABELS[code] ?? code).join(", ");
    return value === "ACTIVE"
      ? "Đang hoạt động"
      : value === "INACTIVE"
        ? "Ngừng hoạt động"
        : typeof value === "string"
          ? value
          : "—";
  }
  return (
    <ul className="space-y-1 text-xs text-muted-foreground">
      {Object.entries(fields)
        .filter(
          ([key]) =>
            key in newData &&
            JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]),
        )
        .map(([key, label]) => (
          <li key={key} className="whitespace-pre-wrap break-words">
            {label}: {format(key, oldData[key])} → {format(key, newData[key])}
          </li>
        ))}
    </ul>
  );
}
