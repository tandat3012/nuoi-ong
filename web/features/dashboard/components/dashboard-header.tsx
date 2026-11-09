'use client';

import * as React from 'react';
import Link from 'next/link';
import { RefreshCw, Plus, ScanLine, ArrowDownToLine, ArrowUpFromLine, ClipboardCheck } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { formatRoleName } from '../types/dashboard';

interface DashboardHeaderProps {
  farmName?: string;
  roleCode?: string;
  isStoreFarm?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  canManageWarehouse?: boolean;
}

export function DashboardHeader({
  farmName,
  roleCode,
  onRefresh,
  isRefreshing = false,
  canManageWarehouse = false,
}: DashboardHeaderProps) {
  const [quickMenuOpen, setQuickMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setQuickMenuOpen(false);
      }
    }
    if (quickMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [quickMenuOpen]);

  // Current date formatted in Vietnamese
  const todayFormatted = React.useMemo(() => {
    try {
      const now = new Date();
      return new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(now);
    } catch {
      return '';
    }
  }, []);

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border/60">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {farmName ? `Trang trại ${farmName}` : 'Bảng Điều Khiển'}
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Vận hành
          </span>
          {roleCode && (
            <Badge variant="outline" className="text-xs font-normal">
              {formatRoleName(roleCode)}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground capitalize">
          {todayFormatted} • Bảng điều khiển quản trị và chỉ số hoạt động
        </p>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-9 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </Button>
        )}

        {/* Quick action popup */}
        {canManageWarehouse && (
          <div className="relative" ref={menuRef}>
            <Button
              variant="default"
              size="sm"
              onClick={() => setQuickMenuOpen((prev) => !prev)}
              className="h-9 gap-1.5 text-xs font-semibold shadow-xs"
              aria-expanded={quickMenuOpen}
              aria-haspopup="menu"
            >
              <Plus className="size-4" />
              <span>Thao tác nhanh</span>
            </Button>

            {quickMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-2.5 py-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  Lập chứng từ kho
                </div>
                <Link
                  href="/receipts"
                  onClick={() => setQuickMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary/60 transition-colors"
                >
                  <ArrowDownToLine className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Tạo phiếu nhập kho</span>
                </Link>
                <Link
                  href="/issues"
                  onClick={() => setQuickMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary/60 transition-colors"
                >
                  <ArrowUpFromLine className="size-4 text-amber-600 dark:text-amber-400" />
                  <span>Tạo phiếu xuất kho</span>
                </Link>
                <Link
                  href="/counts"
                  onClick={() => setQuickMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary/60 transition-colors"
                >
                  <ClipboardCheck className="size-4 text-blue-600 dark:text-blue-400" />
                  <span>Phiếu kiểm kê kho</span>
                </Link>
                <div className="my-1 border-t border-border/50" />
                <Link
                  href="/scan"
                  onClick={() => setQuickMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-foreground hover:bg-secondary/60 transition-colors"
                >
                  <ScanLine className="size-4 text-purple-600 dark:text-purple-400" />
                  <span>Quét mã QR tra cứu</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

