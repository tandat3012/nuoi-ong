import { createClerkClient } from '@clerk/backend';
import {
  getDefaultAutoSelectFamilyAttemptTimeout,
  setDefaultAutoSelectFamilyAttemptTimeout,
} from 'node:net';

export const CLERK_CLIENT = Symbol('CLERK_CLIENT');

export const clerkClientProvider = {
  provide: CLERK_CLIENT,
  useFactory: () => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;

    if (!secretKey || !publishableKey) {
      throw new Error('Clerk API keys are not configured');
    }
    // Slow local IPv4 connections need time before Node tries unreachable IPv6.
    if (
      process.env.NODE_ENV === 'development' &&
      getDefaultAutoSelectFamilyAttemptTimeout() < 2_000
    ) {
      setDefaultAutoSelectFamilyAttemptTimeout(2_000);
    }
    return createClerkClient({ secretKey, publishableKey });
  },
};
