export type FarmRoleCode = 'ADMIN' | 'FARM_OWNER' | 'WAREHOUSE_MANAGER' | 'STORE_MANAGER' | 'DELIVERY_STAFF' | 'MAINTENANCE_STAFF' | 'EMPLOYEE' | 'GUEST';

export type FarmMembership = {
  memberId: string;
  farm: { id: string; code: string; name: string };
  roles: FarmRoleCode[];
};

export type AuthContextResponse = {
  user: {
    id: string;
    clerkUserId: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  memberships: FarmMembership[];
  defaultFarmId: string | null;
};
