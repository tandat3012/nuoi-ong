"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Textarea } from "@/shared/components/ui/textarea";
import { updateMember } from "../personnel.api";
import { personnelError } from "../personnel.logic";
import type { PersonnelDetail, WorkProfile } from "../types";
import {
  RoleFields,
  WorkplaceFields,
  WorkProfileFields,
} from "./personnel-fields";

export type PersonnelEditKind = "profile" | "roles" | "warehouses" | "status";

export function PersonnelEdit({
  member,
  farmId,
  farmName,
  kind,
  canAssignOwner,
  onClose,
  onCloseFocus,
  onSaved,
}: {
  member: PersonnelDetail;
  farmId: string;
  farmName: string;
  kind: PersonnelEditKind;
  canAssignOwner: boolean;
  onClose: () => void;
  onCloseFocus: () => void;
  onSaved: () => void;
}) {
  const request = useAuthenticatedRequest();
  const alive = useRef(true);
  const errorFocus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [profile, setProfile] = useState<WorkProfile>({
    employeeCode: member.employeeCode,
    jobTitle: member.jobTitle,
    phone: member.phone,
    note: member.note,
  });
  const [roles, setRoles] = useState(
    member.roleCodes.filter((role) => role !== "ADMIN"),
  );
  const [workplaces, setWorkplaces] = useState(
    member.warehouses.map((w) => ({
      id: w.id,
      label: `${w.code} — ${w.name}${w.status === "INACTIVE" ? " (ngừng hoạt động)" : ""}`,
    })),
  );
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (error) errorFocus.current?.focus();
  }, [error]);
  const reactivating =
    kind === "status" && member.membershipStatus === "INACTIVE";
  const needsRoles = kind === "roles" || reactivating;
  const needsWorkplaces = kind === "warehouses" || reactivating;
  const needsConfirmation = kind === "roles" || kind === "status";
  const title = {
    profile: "Sửa hồ sơ công việc",
    roles: "Thay đổi quyền trong trại",
    warehouses: "Gán nơi làm việc",
    status: reactivating ? "Kích hoạt lại nhân sự" : "Ngừng hoạt động nhân sự",
  }[kind];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const input =
      kind === "profile"
        ? profile
        : kind === "roles"
          ? { roleCodes: roles }
          : kind === "warehouses"
            ? { warehouseIds: workplaces.map((w) => w.id) }
            : {
                status: reactivating ? "ACTIVE" : "INACTIVE",
                reason: reason.trim() || null,
                ...(reactivating
                  ? {
                      roleCodes: roles,
                      warehouseIds: workplaces.map((w) => w.id),
                    }
                  : {}),
              };
    setBusy(true);
    setError(null);
    try {
      await updateMember(request, farmId, member.memberId, kind, input);
      if (alive.current) onSaved();
    } catch (cause) {
      if (alive.current) setError(personnelError(cause).message);
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-xl sm:max-w-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseFocus();
        }}
        onEscapeKeyDown={(event) => {
          const picker =
            event.target instanceof Element
              ? event.target.closest<HTMLElement>("[popover]:popover-open")
              : null;
          if (picker) {
            event.preventDefault();
            picker.hidePopover();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {member.fullName || member.email} · {farmName}. Thay đổi chỉ áp dụng
            cho tư cách thành viên trong trại này.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            {kind === "profile" && (
              <WorkProfileFields value={profile} onChange={setProfile} />
            )}
            {needsRoles && (
              <>
                <RoleFields
                  value={roles}
                  onChange={setRoles}
                  canAssignOwner={canAssignOwner}
                />
                <p className="text-sm text-muted-foreground">
                  Lưu sẽ thay thế các quyền farm hiện tại của thành viên. Quyền
                  quản trị hệ thống được giữ nguyên và không cấp qua màn hình
                  này.
                </p>
              </>
            )}
            {needsRoles && member.roleCodes.includes("ADMIN") && (
              <p className="text-sm text-muted-foreground">
                Quyền quản trị viên đã có được giữ nguyên. Màn hình này không
                cấp hoặc thu hồi quyền quản trị hệ thống.
              </p>
            )}
            {needsWorkplaces && (
              <WorkplaceFields
                farmId={farmId}
                value={workplaces}
                onChange={setWorkplaces}
              />
            )}
            {kind === "status" && (
              <>
                <p className="text-sm">
                  {reactivating
                    ? "Xác nhận lại quyền và bỏ các kho đã ngừng hoạt động trước khi kích hoạt."
                    : "Thành viên mất quyền vào trại sau khi lưu. Tài khoản dùng ở trại khác và lịch sử được giữ nguyên."}
                </p>
                {!reactivating && member.heldAssetCount > 0 && (
                  <p
                    role="status"
                    className="rounded border bg-muted p-3 text-sm"
                  >
                    Nhân sự đang giữ {member.heldAssetCount} tài sản. Có thể thu
                    hồi quyền ngay và xử lý trả tài sản tại module Tài sản sau
                    đó; thao tác này không tự tăng tồn kho.
                  </p>
                )}
                <label className="block space-y-1 text-sm font-medium">
                  <span>Lý do / ghi chú thay đổi</span>
                  <Textarea
                    value={reason}
                    maxLength={1000}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
              </>
            )}
            {needsConfirmation && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  required
                  className="mt-1"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                <span>
                  Tôi xác nhận thay đổi quyền truy cập của thành viên tại{" "}
                  {farmName}.
                </span>
              </label>
            )}
          </fieldset>
          {error && (
            <div ref={errorFocus} tabIndex={-1}>
              <ErrorAlert message={error} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Đóng
            </Button>
            <Button
              type="submit"
              variant={
                kind === "status" && !reactivating ? "destructive" : "default"
              }
              isLoading={busy}
              disabled={
                (needsRoles && !roles.length) ||
                (needsConfirmation && !confirmed)
              }
            >
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
