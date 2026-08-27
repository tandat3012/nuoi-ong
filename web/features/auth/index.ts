export const appRoles = ['admin', 'manager', 'employee'] as const;

export type AppRole = (typeof appRoles)[number];
