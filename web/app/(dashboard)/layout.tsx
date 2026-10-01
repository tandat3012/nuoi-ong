import { AuthContextProvider } from '@/features/auth/context/auth-context';
import { AppShell } from '@/shared/components/layout/app-shell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthContextProvider>
      <AppShell>{children}</AppShell>
    </AuthContextProvider>
  );
}
