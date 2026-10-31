import { cn } from "@/shared/lib/utils";

const CELLS = [
  [13.5, -23.4],
  [27, 0],
  [13.5, 23.4],
  [-13.5, 23.4],
  [-27, 0],
  [-13.5, -23.4],
  [0, 0],
] as const;

/**
 * Honeycomb that fills with honey while a bee circles it. The comb, orbit and
 * bob animate only transform/opacity on HTML elements, so they stay on the
 * compositor while the main thread is busy loading the page (only the tiny wing
 * flap is SVG). It fades in after 300ms so fast navigations never flash it.
 * Styles live in globals.css.
 */
export function BeeLoader({
  label = "Đang tải...",
  size = "md",
  className,
}: {
  label?: string;
  /** md: a page or main section; sm: a panel, card, dialog or table body. */
  size?: "md" | "sm";
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "bee-loader flex flex-col items-center",
        size === "md" ? "gap-4 py-12" : "gap-2 py-4",
        className,
      )}
    >
      {/* zoom scales the drawing and its layout box together. */}
      <div
        className="relative size-28"
        style={size === "sm" ? { zoom: 0.6 } : undefined}
        aria-hidden="true"
      >
        {CELLS.map(([x, y], index) => (
          <span
            key={index}
            className="bee-loader-cell"
            style={{ transform: `translate(${x}px, ${y}px)` }}
          >
            <span
              className="bee-loader-honey"
              style={{ animationDelay: `${index * 0.2}s` }}
            />
          </span>
        ))}
        <span className="bee-loader-orbit">
          <span className="bee-loader-bee">
            <svg viewBox="-9 -8 18 13" className="size-8 overflow-visible">
              <g className="bee-loader-wings">
                <ellipse cx="-1.5" cy="-4" rx="3.2" ry="2.2" />
                <ellipse cx="1.2" cy="-4.4" rx="2.6" ry="1.9" />
              </g>
              <path d="M-5 0 L-7.6 0.2 L-5 1.2 Z" fill="#2d241e" />
              <ellipse cx="0" cy="0.3" rx="5.2" ry="3.6" fill="#fbbf24" />
              <path
                d="M-1.6 -2.9 V3.5 M1.6 -2.9 V3.5"
                stroke="#2d241e"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
              <circle cx="5.6" cy="0" r="2.3" fill="#2d241e" />
              <path
                d="M6.4 -2 Q7.4 -4.4 8.8 -4.6"
                stroke="#2d241e"
                strokeWidth="0.6"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </span>
      </div>
      <p
        className={cn(
          "text-center font-medium text-muted-foreground",
          size === "md" ? "text-sm" : "text-xs",
        )}
      >
        {label}
      </p>
    </div>
  );
}
