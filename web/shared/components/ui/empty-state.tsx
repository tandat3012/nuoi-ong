import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  const renderIcon = () => {
    if (!icon) {
      return <Inbox className="size-8 text-muted-foreground/70" aria-hidden="true" />;
    }
    // Lucide icons are forwardRef objects, so a type check for 'function' misses them.
    if (React.isValidElement(icon)) return icon;
    const IconComponent = icon as LucideIcon;
    return <IconComponent className="size-8 text-muted-foreground/70" aria-hidden="true" />;
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center sm:p-12',
        className,
      )}
      {...props}
    >
      <div className="grid size-12 place-items-center rounded-xl bg-muted/60 mb-3">
        {renderIcon()}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-normal">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
