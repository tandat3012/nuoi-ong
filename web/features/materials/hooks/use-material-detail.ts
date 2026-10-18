'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApiRequestOptions } from '@/shared/api/client';
import type { MaterialDetail, MaterialListRow } from '../types/material';
import { getMaterialById } from '../api/materials.api';
import { formatApiError } from './format-api-error';
import type { MaterialsViewMode } from '../types/view-mode';

type AuthenticatedRequest = <T>(
  path: string,
  options?: Omit<ApiRequestOptions, 'accessToken'>,
) => Promise<T>;

export function useMaterialDetail(
  request: AuthenticatedRequest,
  selectedFarmId: string | null,
  canWrite: boolean,
) {
  const [viewMode, setViewMode] = useState<MaterialsViewMode>('list');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialDetail | null>(
    null,
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const alive = useRef(false);
  const detailRequest = useRef(0);
  const submitting = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      detailRequest.current += 1;
    };
  }, []);

  async function openMaterial(id: string, mode: 'detail' | 'edit') {
    if (!selectedFarmId || (mode === 'edit' && !canWrite) || submitting.current)
      return;
    const requestId = ++detailRequest.current;
    setDetailId(id);
    setSelectedMaterial(null);
    setViewMode(mode);
    setDetailError(null);
    setSaveError(null);
    setIsDetailLoading(true);
    try {
      const response = await getMaterialById(request, id, selectedFarmId);
      if (!alive.current || requestId !== detailRequest.current) return;
      setSelectedMaterial(response.data);
    } catch (error: unknown) {
      if (alive.current && requestId === detailRequest.current)
        setDetailError(formatApiError(error));
    } finally {
      if (alive.current && requestId === detailRequest.current)
        setIsDetailLoading(false);
    }
  }

  function backToList() {
    if (submitting.current) return;
    detailRequest.current += 1;
    setSelectedMaterial(null);
    setDetailId(null);
    setDetailError(null);
    setSaveError(null);
    setIsDetailLoading(false);
    setViewMode('list');
  }

  return {
    viewMode,
    setViewMode,
    selectedMaterial,
    setSelectedMaterial,
    detailId,
    isDetailLoading,
    detailError,
    saveError,
    setSaveError,
    notice,
    setNotice,
    alive,
    submitting,
    openMaterial,
    backToList,
    onViewDetail: (row: MaterialListRow) => {
      void openMaterial(row.item.id, 'detail');
    },
    onStartEdit: (material: MaterialDetail) => {
      void openMaterial(material.item.id, 'edit');
    },
    onStartCreate: () => {
      if (!canWrite || submitting.current) return;
      detailRequest.current += 1;
      setSelectedMaterial(null);
      setDetailError(null);
      setSaveError(null);
      setIsDetailLoading(false);
      setViewMode('create');
    },
    onBackToList: backToList,
    onRetryDetail: () => {
      if (detailId)
        void openMaterial(detailId, viewMode === 'edit' ? 'edit' : 'detail');
    },
  };
}
