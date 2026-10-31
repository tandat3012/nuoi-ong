"use client";

import { AssetLookup } from "@/features/assets/components/asset-lookup";
import type { AssetChoice } from "@/features/assets/types/asset";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { ROLE_LABELS, type WorkProfile } from "../types";

const OPERATIONAL_ROLES = ["WAREHOUSE_MANAGER", "STORE_MANAGER", "EMPLOYEE", "GUEST"];

export function WorkProfileFields({
  value,
  onChange,
}: {
  value: WorkProfile;
  onChange: (value: WorkProfile) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(["employeeCode", "jobTitle", "phone"] as const).map((key) => (
        <label key={key} className="space-y-1 text-sm font-medium">
          <span>
            {
              {
                employeeCode: "Mã nhân viên",
                jobTitle: "Chức danh công việc",
                phone: "Điện thoại liên hệ tại trại",
              }[key]
            }
          </span>
          <Input
            value={value[key] ?? ""}
            maxLength={key === "jobTitle" ? 100 : 50}
            type={key === "phone" ? "tel" : "text"}
            onChange={(event) =>
              onChange({ ...value, [key]: event.target.value || null })
            }
          />
        </label>
      ))}
      <label className="space-y-1 text-sm font-medium sm:col-span-2">
        <span>Ghi chú</span>
        <Textarea
          value={value.note ?? ""}
          maxLength={4000}
          onChange={(event) =>
            onChange({ ...value, note: event.target.value || null })
          }
        />
      </label>
    </div>
  );
}

export function RoleFields({
  value,
  onChange,
  canAssignOwner,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  canAssignOwner: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Quyền trong trại</legend>
      <div className="flex flex-wrap gap-4">
        {(canAssignOwner
          ? ["FARM_OWNER", ...OPERATIONAL_ROLES]
          : OPERATIONAL_ROLES
        ).map((code) => (
          <label key={code} className="flex min-h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.includes(code)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, code]
                    : value.filter((role) => role !== code),
                )
              }
            />
            {ROLE_LABELS[code]}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Chức danh không tự cấp quyền. Nhân viên vẫn dùng phạm vi thao tác hiện
        có của hệ thống.
      </p>
    </fieldset>
  );
}

export function WorkplaceFields({
  farmId,
  value,
  onChange,
}: {
  farmId: string;
  value: AssetChoice[];
  onChange: (value: AssetChoice[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Nơi làm việc</legend>
      <AssetLookup
        farmId={farmId}
        kind="warehouse"
        activeOnly
        selected={null}
        disabled={value.length >= 100}
        onSelect={(choice) => {
          if (choice && !value.some((item) => item.id === choice.id))
            onChange([...value, choice]);
        }}
      />
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((choice) => (
            <li
              key={choice.id}
              className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
            >
              <span>{choice.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Bỏ nơi làm việc ${choice.label}`}
                onClick={() =>
                  onChange(value.filter((item) => item.id !== choice.id))
                }
              >
                Bỏ
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Có thể chọn nhiều kho hoặc để trống. Đây là nơi làm việc; quyền truy cập
        vẫn theo toàn trại.
      </p>
    </fieldset>
  );
}
