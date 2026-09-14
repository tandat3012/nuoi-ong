export const appRoles = ['admin', 'manager', 'employee'] as const;

export type AppRole = (typeof appRoles)[number];

export { AuthProvider, FarmSelector, useAuthContext } from './context/auth-context';
export { useAuthenticatedRequest } from './hooks/use-authenticated-request';
