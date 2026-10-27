"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { storeAdminError } from "../store-admin.logic";

export function StoreFormDialog({
  title,
  description,
  submitLabel = "Lưu",
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  description: string;
  submitLabel?: string;
  onSubmit: (data: FormData) => Promise<unknown>;
  onClose: () => void;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        hideCloseButton={pending}
        className="max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-xl"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="min-w-0 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending) return;
            const data = new FormData(event.currentTarget);
            setPending(true);
            setError(null);
            try {
              await onSubmit(data);
              onClose();
            } catch (failure) {
              setError(storeAdminError(failure));
            } finally {
              setPending(false);
            }
          }}
        >
          <fieldset disabled={pending} className="min-w-0 space-y-4">
            {children}
          </fieldset>
          {error && <ErrorAlert message={error} />}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onClose}
            >
              Đóng
            </Button>
            <Button type="submit" isLoading={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
