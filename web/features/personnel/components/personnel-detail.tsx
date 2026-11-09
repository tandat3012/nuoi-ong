"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Pagination } from "@/shared/components/ui/pagination";
import { Badge } from "@/shared/components/ui/badge";
import { EmptyState } from "@/shared/components/ui/empty-state";
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
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  Edit3,
  ExternalLink,
  History,
  Info,
  Mail,
  PackageSearch,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
  Warehouse,
  Boxes,
} from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-400",
  FARM_OWNER: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  WAREHOUSE_MANAGER: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  STORE_MANAGER: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  DELIVERY_STAFF: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  MAINTENANCE_STAFF: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  EMPLOYEE: "border-border bg-muted/60 text-foreground",
  GUEST: "border-border bg-muted/40 text-muted-foreground",
};

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

  // Initials for avatar
  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    return email ? email.slice(0, 2).toUpperCase() : "NV";
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          href="/personnel"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>Danh sách nhân sự</span>
        </Link>
        <Button
          ref={refreshTrigger}
          variant="outline"
          size="sm"
          onClick={reload}
          disabled={!current}
          className="h-8 gap-1.5 text-xs font-medium"
        >
          <RefreshCw
            className={`size-3.5 ${!current ? "motion-safe:animate-spin" : ""}`}
            aria-hidden="true"
          />
          <span>Tải lại</span>
        </Button>
      </div>

      {!current && <BeeLoader label="Đang tải hồ sơ nhân sự…" />}

      {current?.error && (
        <ErrorAlert message={current.error} onRetry={reload} />
      )}

      {member && (
        <>
          {/* Profile Header Hero Card */}
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xs">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/60 font-mono text-lg font-bold text-foreground shadow-2xs">
                  {getInitials(member.fullName, member.email)}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                      {member.fullName || member.email}
                    </h1>
                    <Badge variant="secondary" className="font-semibold text-xs">
                      {farmName}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="size-3.5" aria-hidden="true" />
                      <span className="font-mono">{member.email}</span>
                    </span>
                    {member.phone && (
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="size-3.5" aria-hidden="true" />
                        <span>{member.phone}</span>
                      </span>
                    )}
                  </div>

                  {/* Status & Role badges row */}
                  <div className="flex flex-wrap items-center gap-2 pt-1.5">
                    {/* Membership status */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        member.membershipStatus === "ACTIVE"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          member.membershipStatus === "ACTIVE"
                            ? "bg-emerald-500"
                            : "bg-zinc-400"
                        }`}
                        aria-hidden="true"
                      />
                      <span>
                        {member.membershipStatus === "ACTIVE"
                          ? "Thành viên hoạt động"
                          : "Ngừng hoạt động"}
                      </span>
                    </span>

                    {/* Account status */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        member.accountStatus === "ACTIVE"
                          ? "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                          : "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          member.accountStatus === "ACTIVE"
                            ? "bg-blue-500"
                            : "bg-rose-500"
                        }`}
                        aria-hidden="true"
                      />
                      <span>
                        {member.accountStatus === "ACTIVE"
                          ? "Tài khoản Clerk khả dụng"
                          : "Tài khoản đã khóa"}
                      </span>
                    </span>

                    {/* Roles badges */}
                    {member.roleCodes.map((role) => (
                      <span
                        key={role}
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                          ROLE_COLORS[role] ?? "border-border bg-muted/60 text-foreground"
                        }`}
                      >
                        {ROLE_LABELS[role] ?? role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              {canEdit && (
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => openEdit("profile", event.currentTarget)}
                    className="h-9 gap-1.5 text-xs font-medium"
                  >
                    <Edit3 className="size-3.5" aria-hidden="true" />
                    <span>Sửa hồ sơ</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Job Information Section */}
          <section
            aria-label="Thông tin công việc"
            className="rounded-xl border border-border bg-card shadow-2xs"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <Briefcase className="size-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">
                  Hồ sơ công việc tại trang trại
                </h2>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => openEdit("profile", event.currentTarget)}
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Edit3 className="size-3" aria-hidden="true" />
                  <span>Chỉnh sửa</span>
                </Button>
              )}
            </div>

            <div className="p-5">
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                {/* Employee Code */}
                <div className="space-y-1">
                  <dt className="font-semibold text-muted-foreground">Mã nhân viên</dt>
                  <dd className="font-mono text-xs font-bold text-foreground">
                    {member.employeeCode ? (
                      <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5">
                        {member.employeeCode}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>

                {/* Job Title */}
                <div className="space-y-1">
                  <dt className="font-semibold text-muted-foreground">Chức danh công việc</dt>
                  <dd className="font-medium text-foreground">
                    {member.jobTitle || "—"}
                  </dd>
                </div>

                {/* Farm Phone */}
                <div className="space-y-1">
                  <dt className="font-semibold text-muted-foreground">Điện thoại tại trại</dt>
                  <dd className="font-mono text-foreground">
                    {member.phone ? (
                      <a
                        href={`tel:${member.phone}`}
                        className="text-primary hover:underline"
                      >
                        {member.phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>

                {/* Joined Date */}
                <div className="space-y-1">
                  <dt className="font-semibold text-muted-foreground">Ngày tham gia trại</dt>
                  <dd className="flex items-center gap-1.5 font-medium tabular-nums text-foreground">
                    <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>
                      {new Date(member.joinedAt).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                  </dd>
                </div>

                {/* Held Assets Count */}
                <div className="space-y-1">
                  <dt className="font-semibold text-muted-foreground">Tài sản đang giữ</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs">
                      {member.heldAssetCount} tài sản
                    </span>
                  </dd>
                </div>

                {/* Account status info */}
                <div className="space-y-1">
                  <dt className="font-semibold text-muted-foreground">Trạng thái đăng nhập</dt>
                  <dd className="font-medium text-foreground">
                    {member.accountStatus === "ACTIVE"
                      ? "Đang hoạt động (Clerk Auth)"
                      : "Đã khóa truy cập"}
                  </dd>
                </div>

                {/* Note */}
                <div className="sm:col-span-2 lg:col-span-3 space-y-1 border-t border-border pt-3">
                  <dt className="font-semibold text-muted-foreground">Ghi chú nhân sự</dt>
                  <dd className="whitespace-pre-wrap break-words text-muted-foreground">
                    {member.note || "Không có ghi chú thêm."}
                  </dd>
                </div>
              </dl>

              {/* Notice */}
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3.5 py-2.5 text-[0.6875rem] text-muted-foreground">
                <Info className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>
                  Họ tên và email dùng chung giữa các trang trại qua tài khoản Clerk. Thay đổi hồ sơ công việc tại đây chỉ có hiệu lực trong phạm vi trang trại hiện tại.
                </span>
              </div>
            </div>
          </section>

          {/* Permissions & Workplaces Section */}
          <section
            aria-label="Quyền và nơi làm việc"
            className="rounded-xl border border-border bg-card shadow-2xs"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">
                  Phân quyền & Nơi làm việc
                </h2>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                {/* Roles Panel */}
                <div className="flex flex-col justify-between rounded-xl border border-border bg-muted/20 p-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Quyền hạn trong trang trại
                      </span>
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actorMemberId === member.memberId}
                          onClick={(event) => openEdit("roles", event.currentTarget)}
                          className="h-7 px-2.5 text-xs font-medium"
                        >
                          Đổi quyền
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {member.roleCodes.length > 0 ? (
                        member.roleCodes.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${
                              ROLE_COLORS[role] ?? "border-border bg-muted text-foreground"
                            }`}
                          >
                            {ROLE_LABELS[role] ?? role}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Chưa có quyền được cấp
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-[0.6875rem] text-muted-foreground">
                    Chủ trại và quản trị viên có toàn quyền xem mọi dữ liệu; các vai trò khác hoạt động theo phân quyền hạn định.
                  </p>
                </div>

                {/* Workplaces (Warehouses) Panel */}
                <div className="flex flex-col justify-between rounded-xl border border-border bg-muted/20 p-4">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Nơi làm việc (Kho được gán)
                      </span>
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) =>
                            openEdit("warehouses", event.currentTarget)
                          }
                          className="h-7 px-2.5 text-xs font-medium"
                        >
                          Gán kho
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {member.warehouses.length > 0 ? (
                        member.warehouses.map((w) => (
                          <div
                            key={w.id}
                            className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs"
                          >
                            <Warehouse className="size-3.5 text-muted-foreground" aria-hidden="true" />
                            <span className="font-mono font-bold text-foreground">
                              {w.code}
                            </span>
                            <span className="text-muted-foreground">—</span>
                            <span className="font-medium text-foreground truncate">
                              {w.name}
                            </span>
                            {w.status === "INACTIVE" && (
                              <span className="ml-auto text-[0.6875rem] font-medium text-destructive">
                                (ngừng hoạt động)
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground py-1">
                          Chưa gán kho làm việc nào.
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-[0.6875rem] text-muted-foreground">
                    Quản lý kho và nhân viên chỉ xem và làm việc với các kho được gán ở đây.
                  </p>
                </div>
              </div>

              {/* Status Action & Caution */}
              {canEdit && (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground">
                      Trạng thái hoạt động tại trang trại
                    </span>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {member.membershipStatus === "ACTIVE"
                        ? "Ngừng hoạt động sẽ thu hồi quyền truy cập trang trại. Tài khoản Clerk vẫn được bảo lưu cho các trang trại khác."
                        : "Kích hoạt lại sẽ khôi phục tư cách thành viên và cho phép phân bổ lại quyền truy cập."}
                    </p>
                  </div>

                  <Button
                    variant={
                      member.membershipStatus === "ACTIVE"
                        ? "destructive"
                        : "outline"
                    }
                    size="sm"
                    disabled={actorMemberId === member.memberId}
                    onClick={(event) => openEdit("status", event.currentTarget)}
                    className="shrink-0 h-9 px-4 text-xs font-semibold shadow-xs"
                  >
                    {member.membershipStatus === "ACTIVE"
                      ? "Ngừng hoạt động"
                      : "Kích hoạt lại nhân sự"}
                  </Button>
                </div>
              )}

              {actorMemberId === member.memberId && (
                <p className="text-xs text-muted-foreground">
                  * Bạn đang xem hồ sơ của chính mình. Bạn không thể tự thay đổi quyền hoặc trạng thái thành viên của bản thân.
                </p>
              )}
            </div>
          </section>

          {/* Held Assets Section */}
          <PersonnelRecords
            key={`assets:${attempt}`}
            farmId={farmId}
            memberId={memberId}
            kind="assets"
          />

          {/* Audit History Section */}
          <PersonnelRecords
            key={`history:${attempt}`}
            farmId={farmId}
            memberId={memberId}
            kind="history"
          />

          {/* Edit Dialog */}
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
  const isAssets = kind === "assets";

  const actionLabels: Record<string, string> = {
    PERSONNEL_ADDED: "Thêm nhân sự",
    PERSONNEL_PROFILE_CHANGED: "Cập nhật hồ sơ công việc",
    PERSONNEL_ROLES_CHANGED: "Thay đổi quyền",
    PERSONNEL_WORKPLACES_CHANGED: "Thay đổi nơi làm việc",
    PERSONNEL_STATUS_CHANGED: "Thay đổi trạng thái",
  };

  return (
    <section
      aria-label={isAssets ? "Tài sản đang giữ" : "Lịch sử thay đổi"}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs"
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          {isAssets ? (
            <PackageSearch className="size-4 text-primary" aria-hidden="true" />
          ) : (
            <History className="size-4 text-primary" aria-hidden="true" />
          )}
          <h2 className="text-sm font-semibold text-foreground">
            {isAssets ? "Tài sản đang bàn giao cho nhân sự" : "Lịch sử thay đổi hồ sơ"}
          </h2>
          {current?.response?.page.totalItems !== undefined && (
            <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
              {current.response.page.totalItems} {isAssets ? "tài sản" : "sự kiện"}
            </span>
          )}
        </div>
      </div>

      {isAssets && (
        <div className="border-b border-border/60 bg-muted/10 px-5 py-2.5 text-xs text-muted-foreground">
          Bấm vào mã tài sản để mở chi tiết, thu hồi hoặc chuyển bàn giao. Ngừng hoạt động nhân sự không tự động thay đổi tồn kho.
        </div>
      )}

      {!current && (
        <div className="py-10 text-center">
          <BeeLoader label="Đang tải dữ liệu…" size="sm" />
        </div>
      )}

      {current?.error && (
        <div className="p-5">
          <ErrorAlert
            message={current.error}
            onRetry={() => setQuery({ ...query })}
          />
        </div>
      )}

      {current?.response && (
        <>
          {current.response.data.length === 0 ? (
            <div className="py-10">
              <EmptyState
                icon={isAssets ? Boxes : History}
                title={isAssets ? "Không giữ tài sản nào" : "Chưa có lịch sử thay đổi"}
                description={
                  isAssets
                    ? "Nhân sự hiện tại chưa được cấp phát thiết bị hoặc tài sản nào trong trang trại."
                    : "Các thao tác chỉnh sửa hồ sơ, quyền hoặc nơi làm việc sẽ được lưu vết tại đây."
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border" aria-label="Danh sách bản ghi">
              {current.response.data.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-1.5 p-4 text-xs transition-colors hover:bg-muted/30 sm:px-5"
                >
                  {"assetCode" in row ? (
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2.5">
                        <Link
                          className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2 py-0.5 font-mono text-xs font-bold text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                          href={`/assets/${row.id}`}
                        >
                          {row.assetCode}
                        </Link>
                        <span className="font-medium text-foreground">
                          {row.itemName}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <CalendarDays className="size-3.5" aria-hidden="true" />
                          <span>
                            Nhận ngày {new Date(row.assignedAt).toLocaleDateString("vi-VN")}
                          </span>
                        </span>
                        <Link
                          href={`/assets/${row.id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                          <span>Chi tiết</span>
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">
                          {actionLabels[row.action] ?? "Cập nhật nhân sự"}
                        </span>
                        <span className="font-mono text-[0.6875rem] text-muted-foreground">
                          {new Date(row.createdAt).toLocaleString("vi-VN")}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        Thực hiện bởi: <strong className="font-medium text-foreground">{row.actorName || row.actorEmail || "Hệ thống"}</strong>
                      </p>
                      <HistoryChanges before={row.oldData} after={row.newData} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {current.response.page.totalPages > 1 && (
            <div className="border-t border-border p-4">
              <Pagination
                pageInfo={current.response.page}
                onPageChange={(page) => setQuery({ page })}
                itemLabel={isAssets ? "tài sản" : "bản ghi"}
              />
            </div>
          )}
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
      return `${value.length} kho`;
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

  const changedEntries = Object.entries(fields).filter(
    ([key]) =>
      key in newData &&
      JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]),
  );

  if (changedEntries.length === 0) return null;

  return (
    <div className="mt-1 rounded-md border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground">
      <ul className="space-y-1">
        {changedEntries.map(([key, label]) => (
          <li key={key} className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-foreground">{label}:</span>
            <span className="line-through text-muted-foreground">
              {format(key, oldData[key])}
            </span>
            <span>→</span>
            <span className="font-medium text-foreground">
              {format(key, newData[key])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
