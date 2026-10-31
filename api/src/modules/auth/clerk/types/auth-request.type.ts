import { Request } from 'express';

export type AuthRequest = Request & {
  auth: {
    clerkUserId: string;
    sessionId: string | null;
  };
  /** Active role codes in the request's farm, set by FarmAccessGuard. */
  farmRoleCodes?: string[];
};
