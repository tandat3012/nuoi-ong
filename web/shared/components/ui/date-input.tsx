'use client';

import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  caretAfterDigits,
  digitsToIso,
  formatDigits,
  isoToText,
  maskDigits,
  pastedIsoDigits,
  type DateInputMode,
} from '@/shared/lib/date-input';
import { Input, type InputProps } from './input';

export interface DateInputProps
  extends Omit<InputProps, 'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'> {
  mode?: DateInputMode;
  /** Controlled ISO value (`yyyy-mm-dd`, or `yyyy-mm-ddThh:mm` in datetime mode). */
  value?: string;
  /** Uncontrolled ISO value; submit it through `name`. */
  defaultValue?: string;
  /** Receives the ISO value, or "" while the text is empty or incomplete (like a native date input). */
  onValueChange?: (value: string) => void;
  min?: string;
  max?: string;
}

/**
 * Day-first masked date field: typing "30122005" gives 30/12/2005 in every browser,
 * with a calendar button that opens the native picker.
 */
export function DateInput({
  mode = 'date',
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  name,
  disabled,
  readOnly,
  className,
  placeholder,
  ...props
}: DateInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pickerRef = React.useRef<HTMLInputElement>(null);
  const pendingCaret = React.useRef<number | null>(null);
  const [text, setText] = React.useState(() =>
    isoToText(value ?? defaultValue, mode),
  );
  const isoOf = (current: string) =>
    digitsToIso(maskDigits(current, mode), mode) ?? '';
  const iso = isoOf(text);

  // Follow outside changes (reset, picker in another field) without wiping a half-typed date.
  const [lastValue, setLastValue] = React.useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if ((value ?? '') !== iso) setText(isoToText(value, mode));
  }

  const invalid = Boolean(
    text && (!iso || (min && iso < min) || (max && iso > max)),
  );
  React.useEffect(() => {
    inputRef.current?.setCustomValidity(
      invalid
        ? mode === 'date'
          ? 'Nhập ngày hợp lệ dạng dd/mm/yyyy.'
          : 'Nhập thời gian hợp lệ dạng dd/mm/yyyy hh:mm.'
        : '',
    );
  }, [invalid, mode]);
  React.useLayoutEffect(() => {
    const input = inputRef.current;
    if (pendingCaret.current === null || !input || document.activeElement !== input) return;
    input.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [text]);

  function update(digits: string, caretDigits: number) {
    const formatted = formatDigits(digits);
    pendingCaret.current = caretAfterDigits(formatted, caretDigits);
    setText(formatted);
    const next = digitsToIso(digits, mode) ?? '';
    if (next !== iso) onValueChange?.(next);
  }

  return (
    <div className="relative w-full">
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder ?? (mode === 'date' ? 'dd/mm/yyyy' : 'dd/mm/yyyy hh:mm')}
        value={text}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={invalid || props['aria-invalid']}
        hasError={invalid}
        className={cn('pr-10', className)}
        onPaste={(event) => {
          const digits = pastedIsoDigits(event.clipboardData.getData('text'), mode);
          if (digits === null) return;
          event.preventDefault();
          update(digits, digits.length);
        }}
        onChange={(event) => {
          const input = event.target;
          let digits = maskDigits(input.value, mode);
          let caret = maskDigits(
            input.value.slice(0, input.selectionStart ?? input.value.length),
            mode,
          ).length;
          // Backspace over a separator removes the digit before it instead of doing nothing.
          const inputType = (event.nativeEvent as InputEvent).inputType;
          if (
            inputType === 'deleteContentBackward' &&
            digits === maskDigits(text, mode) &&
            caret > 0
          ) {
            digits = digits.slice(0, caret - 1) + digits.slice(caret);
            caret -= 1;
          }
          update(digits, caret);
        }}
      />
      {name && <input type="hidden" name={name} value={iso} />}
      <input
        ref={pickerRef}
        type={mode === 'date' ? 'date' : 'datetime-local'}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
        value={iso}
        min={min}
        max={max}
        onChange={(event) => {
          const next = event.target.value;
          const digits = maskDigits(isoToText(next, mode), mode);
          update(digits, digits.length);
        }}
      />
      <button
        type="button"
        aria-label={mode === 'date' ? 'Chọn ngày trên lịch' : 'Chọn thời gian trên lịch'}
        disabled={disabled || readOnly}
        onClick={() => {
          try {
            pickerRef.current?.showPicker();
          } catch {
            inputRef.current?.focus();
          }
        }}
        className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        <CalendarDays className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
