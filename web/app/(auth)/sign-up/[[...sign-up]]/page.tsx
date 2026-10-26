import { SignUp } from '@clerk/nextjs';
import { postSignInUrl } from '@/features/auth/utils/post-sign-in';

export default async function SignUpPage({
  searchParams,
}: PageProps<'/sign-up/[[...sign-up]]'>) {
  const target = postSignInUrl((await searchParams).redirect_url);
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <SignUp forceRedirectUrl={target} signInForceRedirectUrl={target} />
    </main>
  );
}
