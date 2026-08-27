import { AppShell } from '@/shared/components/layout/app-shell';

export default function DashboardLayout({ children }: LayoutProps<'/'>) {
  return <AppShell>{children}</AppShell>;
}
