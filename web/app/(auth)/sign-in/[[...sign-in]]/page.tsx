import { SignIn } from '@clerk/nextjs';
import { postSignInUrl } from '@/features/auth/utils/post-sign-in';

export default async function SignInPage({
  searchParams,
}: PageProps<'/sign-in/[[...sign-in]]'>) {
  const target = postSignInUrl((await searchParams).redirect_url);
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <SignIn
        oauthFlow="popup"
        forceRedirectUrl={target}
        signUpForceRedirectUrl={target}
      />
    </main>
  );
}
