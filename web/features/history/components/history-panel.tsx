"use client";

import { useId, useState } from "react";
import { ChevronDown, History } from "lucide-react";
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
    <section aria-label="Lịch sử thay đổi" className="min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground">
      <h2>
        <Button type="button" variant="ghost" className="h-auto min-h-14 w-full justify-between rounded-none p-4 text-left font-semibold focus-visible:-outline-offset-4! sm:px-6"
          aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)}>
          <span className="flex items-center gap-3">
            <History className="size-4 shrink-0 text-primary" aria-hidden="true" />
            Lịch sử thay đổi
          </span>
          <ChevronDown className={`size-4 shrink-0 text-muted-foreground motion-safe:transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </Button>
      </h2>
      <div id={contentId} hidden={!open} className="border-t">
        {open && <HistoryList farmId={farmId} filters={{ entityType, entityId, page, pageSize: 10 }}
          revision={revision} onPageChange={setPage} />}
      </div>
    </section>
  );
}
