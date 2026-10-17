import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { STOREFRONT_CONFIG } from '../config/storefront-config';
import { Button } from '@/shared/components/ui/button';

export function HomeHero() {
  const { hero } = STOREFRONT_CONFIG;

  return (
    <section
      aria-label="Giới thiệu Mộc Ong"
      className="relative flex min-h-[500px] w-full items-center overflow-hidden bg-stone-900 text-white sm:min-h-[560px] md:min-h-[620px] lg:min-h-[660px]"
    >
      <div className="absolute inset-0 z-0">
        <Image
          src={hero.image.src}
          alt={hero.image.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[72%_center] sm:object-[65%_center] md:object-center"
        />
        {/* Lớp phủ đen nhẹ */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-stone-950/35 via-stone-950/25 to-stone-950/10 sm:bg-gradient-to-r sm:from-stone-950/80 sm:via-stone-950/50 sm:to-stone-950/10 lg:from-stone-950/75 lg:via-stone-950/40 lg:to-transparent"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-8 lg:py-28 lg:ml-36">
        <div className="max-w-xl lg:max-w-2xl text-left">

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/15 px-3.5 py-1 text-xs sm:text-sm font-semibold tracking-wider text-amber-300 backdrop-blur-xs sm:mb-5">
            <span>{hero.eyebrow}</span>
          </div>

          <h1 className="mb-4 font-serif text-3xl font-bold leading-[1.18] tracking-tight text-white sm:mb-5 sm:text-4xl md:text-5xl lg:text-6xl sm:leading-[1.15]">
            {hero.heading.prefix}
            <br className="sm:hidden" />
            <span className="font-serif text-store-hero-highlight">
              {hero.heading.highlight}
            </span>
            {hero.heading.suffix}
          </h1>

          <p className="mb-6 max-w-xl whitespace-pre-line text-sm sm:text-base md:text-lg leading-relaxed text-stone-100/90 sm:mb-8">
            {hero.supportingCopy}
          </p>

          <div className="mb-6 flex flex-wrap items-center gap-3 sm:gap-4 sm:mb-8">
            {hero.primaryAction.isImplemented ? (
              <Link
                href={hero.primaryAction.href}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                {hero.primaryAction.label}
              </Link>
            ) : (
              <Button
                type="button"
                aria-disabled="true"
                size="lg"
                title="Tính năng danh mục sản phẩm đang được chuẩn bị"
                className="h-12 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-md  opacity-90 select-none"
              >
                {hero.primaryAction.label}
              </Button>
            )}

            {hero.secondaryAction.isImplemented ? (
              <Link
                href={hero.secondaryAction.href}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/50 bg-black/20 px-6 text-base font-medium text-white backdrop-blur-xs transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
              >
                {hero.secondaryAction.label}
              </Link>
            ) : (
              <Button
                type="button"
                variant="outline"
                aria-disabled="true"
                size="lg"
                title="Trang câu chuyện Mộc Ong đang được chuẩn bị"
                className="h-12 rounded-xl border border-white/40 bg-black/25 px-6 text-base font-medium text-white/90 backdrop-blur-xs  opacity-85 select-none transition-opacity duration-200 hover:bg-black/55"
              >
                {hero.secondaryAction.label}
              </Button>
            )}
          </div>

          <p className="text-xs sm:text-sm font-medium text-stone-300/85">
            {hero.trustLine}
          </p>
        </div>
      </div>
    </section>
  );
}
