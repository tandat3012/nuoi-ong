export type FarmRoleCode =
  | 'ADMIN'
  | 'FARM_OWNER'
  | 'MAINTENANCE_STAFF'
  | 'WAREHOUSE_MANAGER'
  | 'STORE_MANAGER'
  | 'EMPLOYEE'
  | 'GUEST';

export type FarmMembership = {
  memberId: string;
  farm: {
    id: string;
    code: string;
    name: string;
  };
  roles: FarmRoleCode[];
};

export type AuthContextResponse = {
  user: {
    id: string;
    clerkUserId: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    mustChangePassword: boolean;
  };
  memberships: FarmMembership[];
  defaultFarmId: string | null;
  /** Farms of the user that have online sales settings; empty for customers. */
  storeFarmIds: string[];
};
