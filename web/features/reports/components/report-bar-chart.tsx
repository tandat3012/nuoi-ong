"use client";

import { useEffect, useState } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export type BarSeries = { label: string; data: number[]; color: string };

/** Canvas text colour from the theme token, so axes stay readable in dark mode. */
function useMutedColor() {
  const [color, setColor] = useState("#786f66");
  useEffect(() => {
    const read = () =>
      setColor(getComputedStyle(document.documentElement).getPropertyValue("--muted-foreground").trim() || "#786f66");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);
  return color;
}

export function ReportBarChart({
  labels,
  series,
  stacked = false,
  formatValue,
  formatTick = formatValue,
  ariaLabel,
}: {
  labels: string[];
  series: BarSeries[];
  stacked?: boolean;
  formatValue: (value: number) => string;
  formatTick?: (value: number) => string;
  ariaLabel: string;
}) {
  const muted = useMutedColor();
  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom", labels: { color: muted, boxWidth: 12 } },
      tooltip: {
        callbacks: {
          label: (item) => `${item.dataset.label}: ${formatValue(Number(item.raw))}`,
        },
      },
    },
    scales: {
      x: { stacked, ticks: { color: muted, maxRotation: 0, autoSkip: true }, grid: { display: false } },
      y: {
        stacked,
        beginAtZero: true,
        ticks: { color: muted, precision: 0, callback: (value) => formatTick(Number(value)) },
        grid: { color: `${muted}33` },
      },
    },
  };
  return (
    <div className="h-72 w-full sm:h-80" role="img" aria-label={ariaLabel}>
      <Bar
        options={options}
        data={{
          labels,
          datasets: series.map(({ label, data, color }) => ({
            label,
            data,
            backgroundColor: color,
            borderRadius: 4,
            maxBarThickness: 36,
          })),
        }}
      />
    </div>
  );
}
