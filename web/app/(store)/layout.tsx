import type { Metadata } from 'next';
import { StoreTopBar } from '@/features/commerce/storefront/components/store-topbar';
import { StoreHeader } from '@/features/commerce/storefront/components/store-header';
import { StoreFooter } from '@/features/commerce/storefront/components/store-footer';

export const metadata: Metadata = {
  title: {
    default: 'Mộc Ong - Cửa hàng mật ong & thiết bị nuôi ong',
    template: '%s | Mộc Ong',
  },
  description: 'Mật ong tự nhiên nguyên chất và vật tư thiết bị nuôi ong.',
};

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="storefront flex min-h-screen flex-col bg-background text-foreground antialiased">
      <StoreTopBar />
      <StoreHeader />
      <div className="flex-1">
        {children}
      </div>
      <StoreFooter />
    </div>
  );
}
