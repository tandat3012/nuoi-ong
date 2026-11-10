'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  ClipboardCheck,
  ScanLine,
  ChartColumnBig,
  Sparkles,
} from 'lucide-react';

interface QuickActionsProps {
  canManageWarehouse?: boolean;
}

export function DashboardQuickActions({ canManageWarehouse = true }: QuickActionsProps) {
  if (!canManageWarehouse) return null;

  const actions = [
    {
      title: 'Lập phiếu nhập kho',
      description: 'Nhập vật tư, mật ong hoặc thiết bị',
      href: '/receipts',
      icon: ArrowDownToLine,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 hover:bg-emerald-500/15',
    },
    {
      title: 'Lập phiếu xuất kho',
      description: 'Xuất sử dụng tại trại hoặc xuất bán',
      href: '/issues',
      icon: ArrowUpFromLine,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-500/10 hover:bg-amber-500/15',
    },
    {
      title: 'Điều chuyển giữa các kho',
      description: 'Chuyển hàng giữa các kho trang trại',
      href: '/transfers',
      icon: ArrowRightLeft,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-500/10 hover:bg-blue-500/15',
    },
    {
      title: 'Phiếu kiểm kê kho',
      description: 'Đối chiếu số lượng thực tế với hệ thống',
      href: '/counts',
      icon: ClipboardCheck,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-500/10 hover:bg-indigo-500/15',
    },
    {
      title: 'Quét nhãn QR hiện trường',
      description: 'Tra cứu nhanh thùng ong, thiết bị, lô hàng',
      href: '/scan',
      icon: ScanLine,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-500/10 hover:bg-purple-500/15',
    },
    {
      title: 'Báo cáo Nhập - Xuất - Tồn',
      description: 'Chi tiết biến động và giá trị theo kỳ',
      href: '/reports',
      icon: ChartColumnBig,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-500/10 hover:bg-rose-500/15',
    },
  ];

  return (
    <section aria-label="Thao tác nghiệp vụ nhanh" className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" />
          <span>Thao tác nghiệp vụ nhanh</span>
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              href={action.href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-all hover:border-primary/40 hover:bg-secondary/20"
            >
              <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${action.bg} ${action.color} transition-colors`}>
                <Icon className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  {action.title}
                </span>
                <span className="block text-[0.7rem] text-muted-foreground truncate">
                  {action.description}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

