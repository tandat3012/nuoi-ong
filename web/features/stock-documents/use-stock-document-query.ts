'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { stockDocumentHref, stockDocumentQueryId } from './stock-document.logic';

export function useStockDocumentQuery() {
  const params = useSearchParams();
  const pathname = usePathname();
  const id = stockDocumentQueryId(params);

  function selectId(nextId: string | null) {
    // A request that finishes after the user left this page must not rewrite the new page's URL.
    if (window.location.pathname !== pathname) return;
    window.history.pushState(null, '', stockDocumentHref(pathname, params, nextId));
  }

  return [id, selectId] as const;
}
