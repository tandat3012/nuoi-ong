import * as React from 'react';
import Link from 'next/link';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { STOREFRONT_CONFIG } from '../config/storefront-config';
import { StoreBrand } from './store-brand';

export function StoreFooter() {
  const { brand, footer } = STOREFRONT_CONFIG;

  return (
    <footer className="border-t border-border bg-store-warm text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Cột 1: Thương hiệu và giới thiệu */}
          <div className="flex flex-col gap-4">
            <StoreBrand isLink={false} />

            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {brand.description}
            </p>

            {/* Mạng xã hội */}
            <div className="flex items-center gap-3 pt-2">
              {footer.socialLinks.map((social) => (
                <a
                  key={social.platform}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {social.platform === 'facebook' && (
                    <svg className="size-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  )}
                  {social.platform === 'zalo' && (
                    <span className="text-xs font-bold leading-none" aria-hidden="true">
                      Zalo
                    </span>
                  )}
                  {social.platform === 'youtube' && (
                    <svg className="size-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* Cột 2 & 3: Nhóm liên kết */}
          {footer.groups.map((group) => (
            <div key={group.title} className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold tracking-wider text-foreground uppercase">
                {group.title}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.isImplemented && link.href ? (
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground/80 cursor-default select-none">
                        {link.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Cột 4: Kết nối / Thông tin liên hệ */}
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold tracking-wider text-foreground uppercase">
              {footer.contact.title}
            </h3>

            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2.5">
                <Phone className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                <span>
                  Hotline:{' '}
                  <strong className="font-semibold text-foreground">
                    {footer.contact.hotline}
                  </strong>
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                <span>{footer.contact.email}</span>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                <span>{footer.contact.address}</span>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="size-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                <span>{footer.contact.workingHours}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Khung chân trang: Phương thức thanh toán & Bản quyền */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/80 pt-8 sm:flex-row text-center sm:text-left">
          <p className="text-xs text-muted-foreground">
            {footer.copyright}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Hình thức thanh toán:</span>
            {footer.paymentMethods.map((method) => (
              <span
                key={method}
                className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground"
              >
                {method}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
