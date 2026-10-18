import * as React from 'react';
import Link from 'next/link';
import { Flower2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { STOREFRONT_CONFIG } from '../config/storefront-config';

export function StoreBrand({
  className,
  isLink = true,
  showIcon = false,
}: {
  className?: string;
  isLink?: boolean;
  showIcon?: boolean;
}) {
  const { name, tagline } = STOREFRONT_CONFIG.brand;

  const content = (
    <div className={cn('flex items-center gap-2.5 sm:gap-3 text-left leading-none', className)}>
      {showIcon && (
        <div
          aria-hidden="true"
          className="grid size-9 sm:size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs"
        >
          <Flower2 className="size-5 sm:size-6 text-white" aria-hidden="true" />
        </div>
      )}
      <div className="flex flex-col text-left leading-none">
        <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
          {name}
        </span>
        <span className="text-[0.625rem] font-semibold tracking-widest text-primary uppercase mt-1">
          {tagline}
        </span>
      </div>
    </div>
  );

  if (isLink) {
    return (
      <Link
        href="/"
        className="group inline-flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        aria-label={`${name} - ${tagline}`}
      >
        {content}
      </Link>
    );
  }

  return content;
}
