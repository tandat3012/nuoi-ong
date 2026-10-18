import { createClerkClient } from '@clerk/backend';

export const CLERK_CLIENT = Symbol('CLERK_CLIENT');

export const clerkClientProvider = {
  provide: CLERK_CLIENT,
  useFactory: () => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    const publishableKey = process.env.CLERK_PUBLISHABLE_KEY;

    if (!secretKey || !publishableKey) {
      throw new Error('Clerk API keys are not configured');
    }
    return createClerkClient({ secretKey, publishableKey });
  },
};
