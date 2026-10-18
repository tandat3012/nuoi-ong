'use client';

import { useAuthenticatedRequest } from '@/features/auth/hooks/use-authenticated-request';
import { useFarmPermissions } from './use-farm-permissions';
import { initialFilters, useMaterialFilters } from './use-material-filters';
import { useMaterialReferences } from './use-material-references';
import { useMaterialList } from './use-material-list';
import { useMaterialDetail } from './use-material-detail';
import { useMaterialMutations } from './use-material-mutations';

export type { MaterialsViewMode } from '../types/view-mode';

export function useMaterials() {
  const request = useAuthenticatedRequest();
  const { selectedFarmId, farmName, canWrite } = useFarmPermissions();

  const {
    filters,
    setFilters,
    onSearchChange,
    onStatusChange,
    onKindChange,
    onTrackingModeChange,
    onCategoryChange,
    onResetFilters,
    onPageChange,
    onReload,
  } = useMaterialFilters();

  const {
    categories,
    units,
    referencesLoading,
    referencesError,
    onReloadReferences,
  } = useMaterialReferences(request);

  const { materials, pageInfo, isLoading, errorMessage } = useMaterialList(
    request,
    selectedFarmId,
    filters,
    setFilters,
  );

  const {
    viewMode,
    setViewMode,
    selectedMaterial,
    setSelectedMaterial,
    isDetailLoading,
    detailError,
    saveError,
    setSaveError,
    notice,
    setNotice,
    alive,
    submitting,
    onViewDetail,
    onStartEdit,
    onStartCreate,
    onBackToList,
    onRetryDetail,
  } = useMaterialDetail(request, selectedFarmId, canWrite);

  const { isSubmitting, onFormSubmit } = useMaterialMutations({
    request,
    selectedFarmId,
    canWrite,
    viewMode,
    selectedMaterial,
    alive,
    submitting,
    setSaveError,
    setNotice,
    setFilters,
    setViewMode,
    setSelectedMaterial,
    initialFilters,
  });

  return {
    farmName,
    canWrite,
    viewMode,
    selectedMaterial,
    filters,
    materials,
    pageInfo,
    isLoading,
    errorMessage,
    categories,
    units,
    referencesLoading,
    referencesError,
    isDetailLoading,
    detailError,
    saveError,
    notice,
    isSubmitting,
    onSearchChange,
    onStatusChange,
    onKindChange,
    onTrackingModeChange,
    onCategoryChange,
    onResetFilters,
    onPageChange,
    onViewDetail,
    onStartCreate,
    onStartEdit,
    onBackToList,
    onFormSubmit,
    onRetryDetail,
    onReloadReferences,
    onReload,
  };
}
