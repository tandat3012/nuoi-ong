export interface IssueReceiptViewer {
  roles: readonly string[];
  memberId?: string | null;
}

export interface IssueReceiptTarget {
  status: string;
  recipientMemberId?: string | null;
  receivedAt?: string | null;
}

/**
 * NV02 receipt: the recipient confirms themselves; a warehouse manager may record it for them (with a note).
 */
export function issueReceiptAction(
  viewer: IssueReceiptViewer,
  issue: IssueReceiptTarget,
): 'self' | 'onBehalf' | null {
  if (issue.status !== 'CONFIRMED' || !issue.recipientMemberId || Boolean(issue.receivedAt)) {
    return null;
  }
  if (viewer.memberId && viewer.memberId === issue.recipientMemberId) {
    return 'self';
  }
  const isManager = viewer.roles.some((role) =>
    ['ADMIN', 'FARM_OWNER', 'WAREHOUSE_MANAGER'].includes(role),
  );
  return isManager ? 'onBehalf' : null;
}
