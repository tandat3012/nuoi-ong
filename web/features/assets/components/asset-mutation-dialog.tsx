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
        className="flex max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-2xl flex-col rounded-xl p-0 overflow-hidden shadow-xl"
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
        <div className="border-b border-border bg-card p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">{title}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>
          </DialogHeader>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
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
          <div className="flex-1 overflow-y-auto p-5">
            <fieldset
              disabled={pending || error?.reloadRequired}
              className="min-w-0 space-y-4"
            >
              {children}
            </fieldset>

            {error && (
              <ErrorAlert
                className="mt-4"
                message={error.message}
                onRetry={error.reloadRequired ? onReload : undefined}
                retryLabel="Tải lại dữ liệu"
              />
            )}
          </div>

          <DialogFooter className="border-t border-border bg-muted/30 p-4 gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={onClose}
              className="h-9 text-xs font-medium"
            >
              Đóng
            </Button>
            <Button
              type="submit"
              size="sm"
              variant={destructive ? "destructive" : "default"}
              isLoading={pending}
              disabled={disabled || error?.reloadRequired}
              className="h-9 text-xs font-semibold shadow-xs"
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
