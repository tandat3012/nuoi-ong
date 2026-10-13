import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'outline';
}

const badgeVariants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-primary/10 text-primary border-primary/20',
  secondary: 'bg-secondary text-secondary-foreground border-transparent',
  success: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-800 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  destructive: 'bg-red-500/10 text-red-700 border-red-500/25 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  info: 'bg-sky-500/10 text-sky-700 border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
  outline: 'border-border text-foreground bg-transparent',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
