"use client";

import { useState } from "react";
import { DateInput } from "./date-input";
import { Button } from "./button";

export function DateRangeFilter({
  onApply,
}: {
  onApply: (range: { dateFrom: string; dateTo: string }) => void;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const invalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm font-medium">
          Từ ngày
          <DateInput
            value={dateFrom}
            onValueChange={setDateFrom}
            className="w-44"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Đến ngày
          <DateInput
            value={dateTo}
            onValueChange={setDateTo}
            className="w-44"
          />
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={invalid}
          onClick={() => onApply({ dateFrom, dateTo })}
        >
          Lọc ngày
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setDateFrom("");
            setDateTo("");
            onApply({ dateFrom: "", dateTo: "" });
          }}
        >
          Xóa ngày
        </Button>
      </div>
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          Từ ngày phải trước hoặc bằng đến ngày.
        </p>
      )}
    </div>
  );
}
