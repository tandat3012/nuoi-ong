export const FARM_ADMIN_ROLES = ['ADMIN', 'FARM_OWNER'] as const;

export function canDecideMaintenance(roles: readonly string[] = []): boolean {
  return roles.some((role) => (FARM_ADMIN_ROLES as readonly string[]).includes(role));
}

export function canApproveMaintenanceRequest(roles: readonly string[] = []): boolean {
  return canDecideMaintenance(roles);
}

export interface MaintenanceWorkflowTarget {
  status: string;
  returnStatus?: string | null;
  finalDecision?: string | null;
}

/**
 * NV04: A passed repair received back in stock waits for the owner's reuse decision.
 */
export function awaitsFinalDecision(record: MaintenanceWorkflowTarget): boolean {
  return (
    record.status === 'COMPLETED' &&
    record.returnStatus === 'CONFIRMED' &&
    !record.finalDecision
  );
}

export function finalDecisionLabel(decision: string | null | undefined): string {
  if (decision === 'REUSE') return 'Cho phép sử dụng lại';
  if (decision === 'HOLD') return 'Tạm giữ, chờ xử lý';
  return '';
}

export function finalDecisionTone(decision: string | null | undefined): 'success' | 'danger' | 'neutral' {
  if (decision === 'REUSE') return 'success';
  if (decision === 'HOLD') return 'danger';
  return 'neutral';
}
