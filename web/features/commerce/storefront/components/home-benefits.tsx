import * as React from 'react';
import { Truck, ShieldCheck, HeartHandshake, RotateCcw } from 'lucide-react';
import { STOREFRONT_CONFIG } from '../config/storefront-config';

const ICON_MAP = {
  shipping: Truck,
  quality: ShieldCheck,
  support: HeartHandshake,
  returns: RotateCcw,
} as const;

export function HomeBenefits() {
  const { benefits } = STOREFRONT_CONFIG;

  return (
    <section
      aria-label="Cam kết dịch vụ"
      className="border-b border-border bg-store-warm text-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/70">
          {benefits.map((benefit, index) => {
            const IconComponent = ICON_MAP[benefit.icon];

            return (
              <div
                key={benefit.id}
                className={`flex items-center gap-3.5 py-4 sm:py-2.5 sm:px-4 lg:px-6 ${
                  index === 0 ? 'sm:pl-0' : ''
                } ${index === benefits.length - 1 ? 'sm:pr-0' : ''}`}
              >
                <div
                  aria-hidden="true"
                  className="grid size-11 sm:size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs"
                >
                  <IconComponent className="size-5 sm:size-6 text-primary" aria-hidden="true" />
                </div>
                <div className="flex flex-col text-left">
                  <h2 className="font-semibold text-sm sm:text-base text-foreground leading-snug">
                    {benefit.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-normal">
                    {benefit.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
