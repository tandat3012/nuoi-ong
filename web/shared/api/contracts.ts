export type PaginatedResponse<T> = {
  data: T[];
  page: {
    number: number;
    size: number;
    totalItems: number;
    totalPages: number;
  };
};

export type ApiMessage = {
  message: string;
};

export type FarmRole = 'ADMIN' | 'FARM_OWNER' | 'EMPLOYEE' | 'GUEST';

export type FarmSummary = {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
};

export type AuthMeResponse = {
  user: {
    id: string;
    clerkUserId: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  memberships: Array<{
    farm: FarmSummary;
    roles: FarmRole[];
  }>;
};
