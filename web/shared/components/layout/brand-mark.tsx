import { cn } from '@/shared/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-2xs', className)}
    >
      <svg
        className="size-1/2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2l7.5 4.3v8.6L12 22l-7.5-4.3V6.3L12 2z" />
        <path d="M12 7l4 2.3v4.6L12 16.2l-4-2.3V9.3L12 7z" fill="currentColor" fillOpacity="0.3" />
      </svg>
    </span>
  );
}
