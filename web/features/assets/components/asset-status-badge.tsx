import { Badge, type BadgeProps } from "@/shared/components/ui/badge";
import { ASSET_STATUS_LABELS, type AssetStatus } from "../types/asset";

const variants: Record<AssetStatus, BadgeProps["variant"]> = {
  AVAILABLE: "success",
  ASSIGNED: "info",
  IN_USE: "default",
  MAINTENANCE: "warning",
  LOST: "destructive",
  RETIRED: "secondary",
  TRANSFER_PENDING: "warning",
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return (
    <Badge variant={variants[status]} className="whitespace-nowrap">
      {ASSET_STATUS_LABELS[status]}
    </Badge>
  );
}
