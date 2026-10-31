import { BeeLoader } from "@/shared/components/ui/bee-loader";

// The shell (sidebar, header) stays interactive; only the content area waits.
export default function DashboardLoading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <BeeLoader label="Đang tải nội dung..." />
    </div>
  );
}
