"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { assetError } from "../asset.logic";

export type AssetWriteError = ReturnType<typeof assetError> | null;
export type AssetMutationFeedback = {
  error: AssetWriteError;
  onError: (error: AssetWriteError) => void;
  onClose: () => void;
  onReload: () => void;
  onSaved: () => void;
  onUnavailable?: (message: string) => void;
  onCloseFocus?: () => void;
};

export function AssetMutationDialog({
  title,
  description,
  submitLabel = "Xác nhận",
  destructive = false,
  disabled = false,
  perform,
  children,
  error,
  onError,
  onClose,
  onReload,
  onSaved,
  onUnavailable,
  onCloseFocus,
}: AssetMutationFeedback & {
  title: string;
  description: string;
  submitLabel?: string;
  destructive?: boolean;
  disabled?: boolean;
  perform: (data: FormData) => Promise<unknown>;
  children?: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy.current) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={
          onCloseFocus
            ? (event) => {
                event.preventDefault();
                onCloseFocus();
              }
            : undefined
        }
        hideCloseButton={pending}
        className="max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-xl"
        onEscapeKeyDown={(event) => {
          const picker =
            event.target instanceof Element
              ? event.target
                  .closest('[role="dialog"][data-state="open"]')
                  ?.querySelector<HTMLElement>("[popover]:popover-open")
              : null;
          if (picker) {
            event.preventDefault();
            picker.hidePopover();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          className="min-w-0 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy.current || disabled || error?.reloadRequired) return;
            const data = new FormData(event.currentTarget);
            busy.current = true;
            setPending(true);
            onError(null);
            try {
              await perform(data);
              if (alive.current) onSaved();
            } catch (failure) {
              if (!alive.current) return;
              const mapped = assetError(failure, true);
              if (
                onUnavailable &&
                failure &&
                typeof failure === "object" &&
                "status" in failure &&
                (failure.status === 403 || failure.status === 404)
              )
                onUnavailable(mapped.message);
              else onError(mapped);
            } finally {
              busy.current = false;
              if (alive.current) setPending(false);
            }
          }}
        >
          <fieldset
            disabled={pending || error?.reloadRequired}
            className="min-w-0 space-y-4"
          >
            {children}
          </fieldset>
          {error && (
            <ErrorAlert
              message={error.message}
              onRetry={error.reloadRequired ? onReload : undefined}
              retryLabel="Tải lại dữ liệu"
            />
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onClose}
            >
              Đóng
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              isLoading={pending}
              disabled={disabled || error?.reloadRequired}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
