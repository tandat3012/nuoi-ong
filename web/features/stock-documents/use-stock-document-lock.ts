"use client";

import { useState } from "react";
import { createStockDocumentLock } from "./stock-document.logic";

export function useStockDocumentLock() {
  const [, setLocked] = useState(false);
  const [lock] = useState(() => createStockDocumentLock(setLocked));
  return lock;
}
