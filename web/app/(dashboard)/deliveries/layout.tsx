import { StoreFarmGate } from "@/features/store-admin";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StoreFarmGate>{children}</StoreFarmGate>;
}
