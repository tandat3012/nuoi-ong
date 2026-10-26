"use client";

import { SignOutButton, useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { personnelError } from "@/features/personnel/personnel.logic";
import { useAuthenticatedRequest } from "../hooks/use-authenticated-request";
import type { AuthContextResponse } from "../types/auth-context";

export function ChangeInitialPassword() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const errorFocus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorFocus.current?.focus();
  }, [error]);
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    let cancelled = false;
    void request<AuthContextResponse>("/auth/me")
      .then((context) => {
        if (cancelled) return;
        if (!context.user.mustChangePassword) router.replace("/dashboard");
        else {
          setRequired(true);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(personnelError(cause).message);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, request, router, attempt]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("Mật khẩu mới phải khác mật khẩu ban đầu.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await request("/auth/change-initial-password", {
        method: "POST",
        data: { currentPassword, newPassword },
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setChanged(true);
      await signOut({ redirectUrl: "/sign-in" });
    } catch (cause) {
      setError(personnelError(cause).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10">
      <h1 className="text-2xl font-semibold">Đổi mật khẩu ban đầu</h1>
      <p className="text-sm text-muted-foreground">
        Đặt mật khẩu riêng trước khi sử dụng hệ thống. Sau khi lưu, bạn cần đăng
        nhập lại.
      </p>
      {error && (
        <div ref={errorFocus} tabIndex={-1}>
          <ErrorAlert
            message={error}
            onRetry={
              !required ? () => setAttempt((value) => value + 1) : undefined
            }
          />
        </div>
      )}
      {changed ? (
        <>
          <p role="status">
            Mật khẩu đã được đổi. Đăng nhập lại bằng mật khẩu mới.
          </p>
          <Button onClick={() => void signOut({ redirectUrl: "/sign-in" })}>
            Đến trang đăng nhập
          </Button>
        </>
      ) : required ? (
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1 text-sm font-medium">
            <span>Mật khẩu hiện tại</span>
            <Input
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            <span>Mật khẩu mới</span>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={1024}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm font-medium">
            <span>Nhập lại mật khẩu mới</span>
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={1024}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <Button type="submit" isLoading={busy}>
            Đổi mật khẩu và đăng nhập lại
          </Button>
        </form>
      ) : (
        !error && <p role="status">Đang kiểm tra tài khoản…</p>
      )}
      <SignOutButton>
        <Button variant="outline">Đăng xuất</Button>
      </SignOutButton>
    </main>
  );
}
