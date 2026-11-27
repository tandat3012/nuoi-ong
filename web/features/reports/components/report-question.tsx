"use client";

import { ExternalLink, Sparkles } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { Warehouse } from "@/features/warehouses";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { askReportFilters, getStockReport } from "../api/reports.api";
import {
  answerLines,
  matchByName,
  missingFilters,
  pickedWithoutAsking,
  questionErrorMessage,
  type ReportFilters,
  type ReportLink,
} from "../report-question.logic";
import { formatDay, reportErrorMessage } from "../reports.logic";
import { formatQuantity } from "../stock-report.logic";
import type { StockReportRow } from "../types/reports";

type Period = { dateFrom: string; dateTo: string };
type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "message"; text: string; error?: boolean }
  | { kind: "pickWarehouse"; period: Period; item: string; question: string; note: string; options: Warehouse[] }
  | { kind: "pickItem"; period: Period; note: string; rows: StockReportRow[] }
  | { kind: "answer"; period: Period; row: StockReportRow };

const byWarehouse = (warehouse: Warehouse) => warehouse;
const byItem = (row: StockReportRow) => ({ code: row.itemCode, name: row.itemName });

/**
 * "Hỏi dữ liệu": Gemini only reads the question into filters; the numbers come from the
 * stock report the user may already see, and the link opens that same row below.
 */
export function ReportQuestion({
  farmId,
  warehouses,
  onOpenReport,
}: {
  farmId: string;
  /** The caller's warehouses as in the report filter; null while loading. */
  warehouses: Warehouse[] | null;
  onOpenReport: (link: ReportLink) => void;
}) {
  const request = useAuthenticatedRequest();
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Only the latest question may change the answer.
  const latest = useRef(0);

  async function loadRows(run: number, period: Period, item: string, question: string, warehouse: Warehouse) {
    setPhase({ kind: "loading" });
    try {
      const { data } = await getStockReport(request, { farmId, ...period, warehouseId: warehouse.id });
      if (run !== latest.current) return;
      const match = matchByName(data.rows, item, byItem);
      const row = pickedWithoutAsking(match, item, question);
      if (row) setPhase({ kind: "answer", period, row });
      else if (match.matches.length)
        setPhase({
          kind: "pickItem",
          period,
          rows: match.matches,
          note: match.exact
            ? `Có ${match.matches.length} dòng trùng tên “${item}” tại ${warehouse.name}. Chọn mặt hàng:`
            : `Không có dòng trùng đúng tên “${item}” tại ${warehouse.name}. Các mặt hàng gần giống:`,
        });
      else
        setPhase({
          kind: "message",
          text: `Không tìm thấy dòng báo cáo phù hợp với “${item}” tại ${warehouse.name}, ${formatDay(period.dateFrom)} – ${formatDay(period.dateTo)}. Báo cáo bỏ qua mặt hàng không có tồn và không phát sinh trong kỳ, nên có thể mặt hàng không có biến động hoặc tên chưa đúng.`,
        });
    } catch (error) {
      if (run === latest.current) setPhase({ kind: "message", text: reportErrorMessage(error), error: true });
    }
  }

  function chooseWarehouse(run: number, filters: ReportFilters, question: string, all: Warehouse[]) {
    const period = { dateFrom: filters.dateFrom!, dateTo: filters.dateTo! };
    const item = filters.item!;
    const match = filters.warehouse ? matchByName(all, filters.warehouse, byWarehouse) : { exact: false, matches: [] };
    const picked = filters.warehouse ? pickedWithoutAsking(match, filters.warehouse, question) : null;
    if (picked) return loadRows(run, period, item, question, picked);
    const { matches } = match;
    const note = !filters.warehouse
      ? "Câu hỏi chưa nói kho nào. Chọn kho:"
      : matches.length
        ? `Kho nào là “${filters.warehouse}”? Chọn kho:`
        : `Không thấy kho “${filters.warehouse}” trong các kho bạn được xem. Chọn kho:`;
    setPhase({ kind: "pickWarehouse", period, item, question, note, options: matches.length ? matches : all });
  }

  async function ask(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || !warehouses) return;
    const run = ++latest.current;
    setPhase({ kind: "loading" });
    try {
      const { data } = await askReportFilters(request, farmId, text);
      if (run !== latest.current) return;
      const missing = missingFilters(data);
      if (missing) setPhase({ kind: "message", text: missing });
      else if (!warehouses.length) setPhase({ kind: "message", text: "Bạn chưa được phân công kho nào." });
      else await chooseWarehouse(run, data, text, warehouses);
    } catch (error) {
      if (run === latest.current) setPhase({ kind: "message", text: questionErrorMessage(error), error: true });
    }
  }

  return (
    <section aria-labelledby="report-question-title" className="space-y-3 rounded-xl border bg-card p-4">
      <h2 id="report-question-title" className="flex items-center gap-2 font-semibold">
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        Hỏi dữ liệu
      </h2>
      <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="report-question" className="sr-only">
          Câu hỏi về nhập – xuất – tồn
        </label>
        <Input
          id="report-question"
          value={question}
          maxLength={300}
          placeholder="VD: Từ đầu tháng đến nay kho Cà Phê nhập và xuất bao nhiêu mật ong hoa cà phê?"
          onChange={(event) => setQuestion(event.target.value)}
          className="flex-1"
        />
        <Button type="submit" isLoading={phase.kind === "loading"} disabled={!question.trim() || !warehouses}>
          Hỏi
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        AI chỉ đọc câu hỏi để chọn kho, mặt hàng và kỳ; số liệu lấy từ báo cáo nhập – xuất – tồn theo quyền của bạn.
      </p>

      <div aria-live="polite">
        {phase.kind === "message" && (
          <p role={phase.error ? "alert" : undefined} className={phase.error ? "text-sm text-destructive" : "text-sm"}>
            {phase.text}
          </p>
        )}
        {phase.kind === "pickWarehouse" && (
          <Choices
            note={phase.note}
            options={phase.options.map((warehouse) => ({ key: warehouse.id, label: warehouse.name }))}
            onPick={(id) => {
              const warehouse = phase.options.find((option) => option.id === id)!;
              void loadRows(++latest.current, phase.period, phase.item, phase.question, warehouse);
            }}
          />
        )}
        {phase.kind === "pickItem" && (
          <Choices
            note={phase.note}
            options={phase.rows.map((row) => ({ key: row.itemId, label: `${row.itemName} (${row.itemCode})` }))}
            onPick={(id) => {
              const row = phase.rows.find((option) => option.itemId === id)!;
              setPhase({ kind: "answer", period: phase.period, row });
            }}
          />
        )}
        {phase.kind === "answer" && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-6">
              {answerLines(phase.row).map((line) => (
                <div key={line.label}>
                  <dt className="text-xs text-muted-foreground">{line.label}</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatQuantity(line.quantity)} {phase.row.unit}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {phase.row.warehouseName} · {phase.row.itemName} ({phase.row.itemCode}) · {formatDay(phase.period.dateFrom)} –{" "}
                {formatDay(phase.period.dateTo)}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenReport({ farmId, ...phase.period, warehouseId: phase.row.warehouseId, itemId: phase.row.itemId })}
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                Mở báo cáo gốc
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Choices({
  note,
  options,
  onPick,
}: {
  note: string;
  options: { key: string; label: string }[];
  onPick: (key: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm">{note}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button key={option.key} type="button" variant="outline" size="sm" onClick={() => onPick(option.key)}>
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
