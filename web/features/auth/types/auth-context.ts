export type FarmRoleCode = 'ADMIN' | 'FARM_OWNER' | 'EMPLOYEE' | 'GUEST';

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
  };
  memberships: FarmMembership[];
  defaultFarmId: string | null;
};
