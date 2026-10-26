"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { AssetChoice } from "@/features/assets/types/asset";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { addExistingPersonnel, createPersonnel } from "../personnel.api";
import { personnelError } from "../personnel.logic";
import type {
  CreatePersonnelInput,
  PersonnelDetail,
  WorkProfile,
} from "../types";
import {
  RoleFields,
  WorkplaceFields,
  WorkProfileFields,
} from "./personnel-fields";

export function PersonnelCreate({
  farmId,
  canAssignOwner,
  onClose,
  onCloseFocus,
  onCreated,
}: {
  farmId: string;
  canAssignOwner: boolean;
  onClose: () => void;
  onCloseFocus: () => void;
  onCreated: (member: PersonnelDetail) => void;
}) {
  const request = useAuthenticatedRequest();
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [mode, setMode] = useState("new");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [handover, setHandover] = useState(false);
  const [profile, setProfile] = useState<WorkProfile>({
    employeeCode: null,
    jobTitle: null,
    phone: null,
    note: null,
  });
  const [roles, setRoles] = useState(["EMPLOYEE"]);
  const [workplaces, setWorkplaces] = useState<AssetChoice[]>([]);
  const [submission, setSubmission] = useState<Omit<
    CreatePersonnelInput,
    "initialPassword"
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof personnelError> | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const errorFocus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorFocus.current?.focus();
  }, [error]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setPending(false);
    const payload = submission ?? {
      ...profile,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      roleCodes: roles,
      warehouseIds: workplaces.map((w) => w.id),
      requestId: crypto.randomUUID(),
    };
    if (mode === "new") setSubmission(payload);
    try {
      const result =
        mode === "new"
          ? await createPersonnel(request, farmId, {
              ...payload,
              initialPassword: password,
            })
          : await addExistingPersonnel(request, farmId, {
              ...profile,
              email: email.trim().toLowerCase(),
              roleCodes: roles,
              warehouseIds: workplaces.map((w) => w.id),
            });
      if (!alive.current) return;
      if ("data" in result) {
        setPassword("");
        onCreated(result.data);
      } else setPending(true);
    } catch (cause) {
      if (alive.current) setError(personnelError(cause));
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          setPassword("");
          onClose();
        }
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
          <DialogTitle>Thêm nhân sự</DialogTitle>
          <DialogDescription>
            Tài khoản đăng nhập riêng; hồ sơ công việc thuộc trại đang chọn.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <fieldset
            disabled={busy || !!submission}
            className="min-w-0 space-y-4"
          >
            <label className="block space-y-1 text-sm font-medium">
              <span>Cách thêm nhân sự</span>
              <Select
                value={mode}
                onChange={(event) => setMode(event.target.value)}
              >
                <option value="new">Tạo tài khoản mới</option>
                <option value="existing">Thêm tài khoản có sẵn</option>
              </Select>
            </label>
            {mode === "new" && (
              <label className="block space-y-1 text-sm font-medium">
                <span>Họ và tên</span>
                <Input
                  value={fullName}
                  required
                  maxLength={255}
                  autoComplete="name"
                  onChange={(event) => setFullName(event.target.value)}
                />
              </label>
            )}
            <label className="block space-y-1 text-sm font-medium">
              <span>Email đăng nhập</span>
              <Input
                type="email"
                value={email}
                required
                maxLength={255}
                autoComplete="off"
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {mode === "existing" && (
              <p className="text-sm text-muted-foreground">
                Nhập email chính xác. Tên, email và mật khẩu tài khoản hiện có
                được giữ nguyên.
              </p>
            )}
            <WorkProfileFields value={profile} onChange={setProfile} />
            <RoleFields
              value={roles}
              onChange={setRoles}
              canAssignOwner={canAssignOwner}
            />
            <WorkplaceFields
              farmId={farmId}
              value={workplaces}
              onChange={setWorkplaces}
            />
          </fieldset>
          {mode === "new" && (
            <div className="space-y-3">
              <label className="block space-y-1 text-sm font-medium">
                <span>Mật khẩu ban đầu</span>
                <Input
                  type={visible ? "text" : "password"}
                  value={password}
                  required
                  minLength={8}
                  maxLength={1024}
                  autoComplete="new-password"
                  disabled={
                    busy ||
                    (!!submission && error?.code !== "INVALID_CREDENTIALS")
                  }
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              </Button>
              <label className="flex items-start gap-2 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  required
                  checked={handover}
                  onChange={(event) => setHandover(event.target.checked)}
                />
                <span>
                  Tôi sẽ bàn giao thông tin đăng nhập trực tiếp hoặc qua kênh
                  riêng. Nhân viên phải đổi mật khẩu khi đăng nhập; hệ thống
                  không lưu mật khẩu để xem lại.
                </span>
              </label>
            </div>
          )}
          {submission && (
            <p className="break-all text-xs text-muted-foreground">
              Mã yêu cầu: {submission.requestId}. Khi thử lại, hệ thống tiếp tục
              yêu cầu này; mật khẩu đã tạo sẽ không bị thay thế. Giữ mã này nếu
              cần hỗ trợ.
            </p>
          )}
          {pending && (
            <p role="status" className="text-sm">
              Tài khoản đang được xử lý và chưa sẵn sàng đăng nhập. Dùng nút bên
              dưới để kiểm tra lại.
            </p>
          )}
          {error && (
            <div ref={errorFocus} tabIndex={-1}>
              <ErrorAlert message={error.message} />
              {submission && (
                <p className="mt-2 text-sm">
                  Chưa xác nhận tài khoản sẵn sàng đăng nhập. Chỉ bàn giao thông
                  tin sau khi hệ thống báo tạo thành công.
                </p>
              )}
            </div>
          )}
          {error?.code === "ACCOUNT_ALREADY_EXISTS" && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSubmission(null);
                setMode("existing");
                setPassword("");
                setError(null);
              }}
            >
              Xác nhận thêm tài khoản có sẵn
            </Button>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPassword("");
                onClose();
              }}
            >
              Đóng
            </Button>
            <Button
              type="submit"
              isLoading={busy}
              disabled={!roles.length || (mode === "new" && !handover)}
            >
              {submission ? "Kiểm tra / thử lại cùng yêu cầu" : "Thêm nhân sự"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
