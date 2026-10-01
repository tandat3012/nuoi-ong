"use client";

import { useState } from "react";
import type { ApiRequestOptions } from "@/shared/api/client";
import type {
  CreateMaterialInput,
  MaterialDetail,
  MaterialFilterParams,
  UpdateMaterialInput,
} from "../types/material";
import { createMaterial, updateMaterial } from "../api/materials.api";
import { formatApiError } from "./format-api-error";
import type { MaterialsViewMode } from "../types/view-mode";

type AuthenticatedRequest = <T>(
  path: string,
  options?: Omit<ApiRequestOptions, "accessToken">,
) => Promise<T>;

export function useMaterialMutations(options: {
  request: AuthenticatedRequest;
  selectedFarmId: string | null;
  canWrite: boolean;
  viewMode: MaterialsViewMode;
  selectedMaterial: MaterialDetail | null;
  alive: React.RefObject<boolean>;
  submitting: React.MutableRefObject<boolean>;
  setSaveError: (error: string | null) => void;
  setNotice: (notice: string | null) => void;
  setFilters: React.Dispatch<React.SetStateAction<MaterialFilterParams>>;
  setViewMode: (mode: MaterialsViewMode) => void;
  setSelectedMaterial: (material: MaterialDetail | null) => void;
  initialFilters: MaterialFilterParams;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { submitting: submittingRef } = options;

  async function submit(payload: CreateMaterialInput | UpdateMaterialInput) {
    const {
      request,
      selectedFarmId,
      canWrite,
      viewMode,
      selectedMaterial,
      alive,
      setSaveError,
      setNotice,
      setFilters,
      setViewMode,
      setSelectedMaterial,
      initialFilters,
    } = options;

    if (submittingRef.current) return;
    if (!selectedFarmId || !canWrite) {
      setSaveError("Bạn không có quyền lưu vật tư trong trang trại này.");
      return;
    }
    if (viewMode !== "create" && (viewMode !== "edit" || !selectedMaterial))
      return;
    if (Object.keys(payload).length === 0) {
      setSaveError("Chưa có thay đổi để lưu.");
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setSaveError(null);
    setNotice(null);
    try {
      const response =
        viewMode === "create"
          ? await createMaterial(
              request,
              selectedFarmId,
              payload as CreateMaterialInput,
            )
          : await updateMaterial(
              request,
              selectedMaterial!.item.id,
              selectedFarmId,
              payload,
            );
      if (!alive.current) return;
      setNotice(
        "Đã " +
          (viewMode === "create" ? "tạo" : "cập nhật") +
          " vật tư " +
          response.data.item.code +
          ".",
      );
      if (viewMode === "create") {
        setFilters({ ...initialFilters });
        setViewMode("list");
      } else {
        setSelectedMaterial(response.data);
        setViewMode("detail");
      }
      if (viewMode === "edit") setFilters((previous) => ({ ...previous }));
    } catch (error: unknown) {
      if (alive.current) setSaveError(formatApiError(error, true));
    } finally {
      submittingRef.current = false;
      if (alive.current) setIsSubmitting(false);
    }
  }

  return {
    isSubmitting,
    onFormSubmit: submit,
  };
}
