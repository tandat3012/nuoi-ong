'use client';

import * as React from 'react';
import { useAuthenticatedRequest, useFarmMembership } from '@/features/auth';
import { ErrorAlert } from '@/shared/components/ui/error-alert';
import type { DashboardSummary } from '../types/dashboard';
import { DashboardHeader } from './dashboard-header';
import { DashboardActionRadar } from './dashboard-action-radar';
import { DashboardKpiGrid } from './dashboard-kpi-grid';
import { DashboardQuickActions } from './dashboard-quick-actions';
import { DashboardTrendSummary } from './dashboard-trend-summary';
import { DashboardActivityFeed } from './dashboard-activity-feed';

export function DashboardOverview() {
  const access = useFarmMembership();
  const {
    membership,
    selectedFarmId,
    isStoreFarm,
    canViewMetrics,
    canManageStore,
    canManageWarehouse,
  } = access;

  const request = useAuthenticatedRequest();
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [result, setResult] = React.useState<{
    key: string;
    data: DashboardSummary | null;
  } | null>(null);

  const handleRefresh = React.useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const requestKey = `${selectedFarmId}:${refreshKey}`;
  const canFetch = Boolean(selectedFarmId && canViewMetrics);

  React.useEffect(() => {
    if (!selectedFarmId || !canViewMetrics) return;

    let cancelled = false;
    request<{ data: DashboardSummary }>('/dashboard/summary', {
      params: { farmId: selectedFarmId },
    })
      .then(({ data }) => {
        if (!cancelled) setResult({ key: requestKey, data });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [request, selectedFarmId, canViewMetrics, requestKey]);

  const isLoading = canFetch && result?.key !== requestKey;
  const error = canFetch && result?.key === requestKey && result.data === null;
  const summary = result?.key.startsWith(`${selectedFarmId}:`) ? result.data : null;

  if (!membership || !selectedFarmId) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-semibold text-foreground">Chọn trang trại để bắt đầu làm việc</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vui lòng chọn trang trại từ thanh điều hướng trên cùng để truy cập bảng điều khiển vận hành.
        </p>
      </div>
    );
  }

  const primaryRole = membership.roles[0];
  const showOrders = isStoreFarm && canManageStore;

  return (
    <div className="space-y-6 pb-8 max-w-7xl mx-auto">
      {/* Executive Header with Refresh & Quick Actions */}
      <DashboardHeader
        farmName={membership.farm.name}
        roleCode={primaryRole}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
        canManageWarehouse={canManageWarehouse}
        isStoreFarm={isStoreFarm}
      />

      {error && (
        <ErrorAlert message="Không tải được số liệu tổng quan của trang trại. Vui lòng thử bấm Làm mới lại." />
      )}

      {/* Tầng 1: Action Radar - Cảnh báo khẩn & Việc cần xử lý ngay */}
      {summary && canViewMetrics && (
        <DashboardActionRadar summary={summary} showOrders={showOrders} />
      )}

      {/* Tầng 2: Executive KPI Cards */}
      {canViewMetrics && (
        <DashboardKpiGrid
          summary={summary}
          isLoading={isLoading}
          showOrders={showOrders}
        />
      )}

      {/* Phím tắt thao tác nhanh */}
      <DashboardQuickActions canManageWarehouse={canManageWarehouse} />

      {/* Tầng 3: Operational Workspace (Biểu đồ xu hướng & Nhật ký thao tác) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className={canManageWarehouse ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <DashboardTrendSummary
            key={`trend-${selectedFarmId}-${refreshKey}`}
            farmId={selectedFarmId}
            canManageWarehouse={canManageWarehouse}
          />
        </div>
        <div className={canManageWarehouse ? 'lg:col-span-5' : 'lg:col-span-12'}>
          <DashboardActivityFeed
            key={`feed-${selectedFarmId}-${refreshKey}`}
            farmId={selectedFarmId}
          />
        </div>
      </div>
    </div>
  );
}
