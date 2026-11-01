'use client';

import * as React from 'react';
import {
  getCartAvailability,
  type CartAvailability,
} from '../../products/api/product.api';
import {
  availabilityLabels,
  cartLineName,
  splitOrderSuggestions,
  storeRegionLabels,
} from '../../region/region.logic';
import { useStoreRegion } from '../../region/region-context';
import { useCart } from '../hooks/use-cart';

/** Whether one warehouse of the chosen region can ship the whole cart. */
export function CartRegionCheck({ hideSuccess = false }: { hideSuccess?: boolean }) {
  const { items } = useCart();
  const { region, openPicker } = useStoreRegion();
  const lines = items.flatMap((item) =>
    item.variantId ? [{ variantId: item.variantId, quantity: item.quantity }] : [],
  );
  const key = JSON.stringify(lines);
  const [result, setResult] = React.useState<{
    key: string;
    data: CartAvailability | null;
  } | null>(null);

  React.useEffect(() => {
    if (!region || lines.length === 0) return;
    let active = true;
    const timer = setTimeout(() => {
      getCartAvailability(region, JSON.parse(key))
        .then((data) => active && setResult({ key: region + key, data }))
        .catch(() => active && setResult({ key: region + key, data: null }));
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // `key` carries the lines.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, key]);

  if (lines.length === 0) return null;
  if (!region)
    return (
      <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
        Chọn khu vực giao hàng để kiểm tra giỏ.{' '}
        <button type="button" onClick={openPicker} className="underline">
          Chọn miền
        </button>
      </p>
    );
  if (result?.key !== region + key)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Đang kiểm tra khả năng giao tới {storeRegionLabels[region]}…
      </p>
    );
  if (!result.data)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Chưa kiểm tra được khu vực giao hàng; máy chủ sẽ kiểm tra lại khi đặt.
      </p>
    );

  const { canOrder, groups } = result.data;
  const problems = result.data.lines.filter(
    ({ availability }) => availability !== 'AVAILABLE',
  );
  return (
    <div role="status" className="space-y-1 text-sm">
      {canOrder && !hideSuccess ? (
        <p className="text-emerald-700 dark:text-emerald-400">
          Có thể giao cả giỏ tới {storeRegionLabels[region]}.
        </p>
      ) : !canOrder ? (
        <p className="text-amber-800 dark:text-amber-300">
          Chưa có kho nào tại {storeRegionLabels[region]} đáp ứng đủ cả giỏ
          hàng.
        </p>
      ) : null}
      {problems.map(({ variantId, availability }) => (
        <p key={variantId} className="text-muted-foreground">
          {cartLineName(items, variantId)}: {availabilityLabels[availability]}
        </p>
      ))}
      {!canOrder && groups.length > 1 && (
        <>
          <p className="text-muted-foreground">Bạn có thể tách thành các đơn:</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {splitOrderSuggestions(groups, items).map((group) => (
              <li key={group}>{group}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
