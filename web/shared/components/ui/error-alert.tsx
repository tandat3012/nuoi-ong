import * as React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/shared/lib/utils';

export interface ErrorAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorAlert({
  title = 'Đã xảy ra lỗi:',
  message,
  onRetry,
  retryLabel = 'Thử lại',
  className,
  ...props
}: ErrorAlertProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="size-5 shrink-0 mt-0.5 text-destructive" aria-hidden="true" />
        <div>
          {title && <p className="font-semibold leading-tight">{title}</p>}
          <p className="mt-0.5 text-destructive/90">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="self-start sm:self-auto shrink-0 border-destructive/40 bg-card text-destructive hover:bg-destructive/10 h-8 gap-1.5 text-xs font-semibold"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          <span>{retryLabel}</span>
        </Button>
      )}
    </div>
  );
}
