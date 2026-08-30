import { Request } from 'express';

export type AuthRequest = Request & {
  auth: {
    clerkUserId: string;
    sessionId: string | null;
  };
};
