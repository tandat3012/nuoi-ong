import { PostSignInRedirect } from '@/features/auth/components/post-sign-in-redirect';

export default async function AuthContinuePage({
  searchParams,
}: PageProps<'/auth/continue'>) {
  const { next } = await searchParams;
  return <PostSignInRedirect next={typeof next === 'string' ? next : null} />;
}
