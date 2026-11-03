/** Operational screens in the mobile app are for employees in the selected farm. */
export function canUseMobileOperations(roles: readonly string[] | undefined): boolean {
  return roles?.includes('EMPLOYEE') ?? false;
}
