"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { HistoryList } from "./history-list";

export function HistoryPanel({ farmId, entityType, entityId, revision }: {
  farmId: string;
  entityType: string;
  entityId: string;
  revision: number;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const contentId = useId();
  return (
    <section aria-label="Lịch sử thay đổi" className="min-w-0 rounded-xl border bg-card">
      <h2>
        <Button type="button" variant="ghost" className="h-auto w-full justify-between p-4 text-left font-semibold"
          aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)}>
          Lịch sử thay đổi
          <ChevronDown className={`size-4 shrink-0 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </Button>
      </h2>
      <div id={contentId} hidden={!open}>
        {open && <HistoryList farmId={farmId} filters={{ entityType, entityId, page, pageSize: 10 }}
          revision={revision} onPageChange={setPage} />}
      </div>
    </section>
  );
}
