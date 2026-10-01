'use client';

import { useId } from 'react';
import { useAuthContext } from '../context/auth-context';
import type { FarmRoleCode } from '../types/auth-context';

const roleLabels: Record<FarmRoleCode, string> = {
  ADMIN: 'Quản trị viên',
  FARM_OWNER: 'Chủ trại',
  EMPLOYEE: 'Nhân viên',
  GUEST: 'Khách',
};

export function FarmSwitcher({ className = '' }: { className?: string }) {
  const id = useId();
  const { data, selectedFarmId, selectFarm } = useAuthContext();
  const membership = data.memberships.find(({ farm }) => farm.id === selectedFarmId);

  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="sr-only">Trại đang làm việc</label>
      <select
        id={id}
        value={selectedFarmId ?? ''}
        disabled={data.memberships.length < 2}
        aria-describedby={`${id}-role`}
        onChange={(event) => selectFarm(event.target.value)}
        className="min-h-11 w-full max-w-64 truncate rounded-xl border bg-card px-3 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default"
      >
        {!membership && <option value="" disabled>Chọn trại</option>}
        {data.memberships.map(({ farm }) => (
          <option key={farm.id} value={farm.id}>{farm.name} ({farm.code})</option>
        ))}
      </select>
      <p id={`${id}-role`} aria-live="polite" className="mt-1 truncate text-xs text-muted-foreground">
        {membership?.roles.map((role) => roleLabels[role] ?? role).join(' · ') || 'Chưa có vai trò'}
      </p>
    </div>
  );
}
