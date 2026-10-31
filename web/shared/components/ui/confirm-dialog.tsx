import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'destructive' | 'default';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy bỏ',
  variant = 'destructive',
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex items-start gap-4">
          <div
            className={`grid size-10 shrink-0 place-items-center rounded-full ${
              variant === 'destructive'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary'
            }`}
            aria-hidden="true"
          >
            <AlertTriangle className="size-5" />
          </div>
          <div className="space-y-2 flex-1">
            <DialogHeader className="text-left">
              <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground pt-1 leading-normal">
                {description}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant}
            size="sm"
            onClick={handleConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type ConfirmOptions = Pick<
  ConfirmDialogProps,
  'title' | 'description' | 'confirmLabel' | 'cancelLabel' | 'variant'
>;

/**
 * In-page replacement for `window.confirm`: `await ask({...})` resolves true on confirm,
 * false on cancel, Escape or backdrop click. Render the returned element once.
 */
export function useConfirm() {
  const [state, setState] = React.useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: (answer: boolean) => void;
  } | null>(null);
  const ask = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) =>
        setState({ open: true, options, resolve }),
      ),
    [],
  );
  const close = (answer: boolean) => {
    if (!state?.open) return;
    state.resolve(answer);
    // Keep the options while the dialog animates out.
    setState({ ...state, open: false });
  };
  const dialog = (
    <ConfirmDialog
      variant="default"
      title=""
      description=""
      {...state?.options}
      open={Boolean(state?.open)}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
      onConfirm={() => close(true)}
    />
  );
  return [ask, dialog] as const;
}
