import type { Metadata } from 'next';
import { CartPageContent } from '@/features/commerce/cart/components/cart-page-content';

export const metadata: Metadata = {
  title: 'Giỏ hàng',
  description: 'Xem lại các sản phẩm mật ong và vật tư nuôi ong đã chọn trong giỏ hàng Mộc Ong.',
};

export default function StoreCartPage() {
  return <CartPageContent />;
}
