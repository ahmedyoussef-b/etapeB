"use client";

import { useState, useCallback } from "react";

export interface CreationMediaItem {
  id: string;
  stepId: string;
  type: "photo" | "video" | "audio" | "signature";
  name: string;
  base64: string;
  mimeType: string;
  size: number;
  timestamp: number;
  geolocation?: { latitude: number; longitude: number } | null;
  previewUrl?: string;
  uploading?: boolean;
  uploaded?: boolean;
  uploadError?: string;
  savedId?: string;
}

interface UseCreationMediaOptions {
  procedureCode: string;
  autoUpload?: boolean;
}

interface MediaUploadResponse {
  success: boolean;
  media?: {
    id: string;
  };
}

async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "API error");
  }
  return data;
}

export function useCreationMedia({ procedureCode, autoUpload = true }: UseCreationMediaOptions) {
  const [media, setMedia] = useState<CreationMediaItem[]>([]);

  const uploadMedia = useCallback(
    async (item: CreationMediaItem) => {
      setMedia((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, uploading: true, uploadError: undefined } : m)),
      );

      try {
        const commaIdx = item.base64.indexOf(",");
        const base64Data = commaIdx >= 0 ? item.base64.slice(commaIdx + 1) : item.base64;

        const result = await apiCall<MediaUploadResponse>("/api/procedures/execution/media", {
          method: "POST",
          body: JSON.stringify({
            procedureCode,
            stepId: item.stepId,
            stepOrder: 0,
            media: {
              name: item.name,
              base64: base64Data,
              mimeType: item.mimeType,
              type: item.type,
              geolocation: item.geolocation,
              timestamp: item.timestamp,
            },
          }),
        });

        if (result.success && result.media) {
          const savedMedia = result.media;
          setMedia((prev) =>
            prev.map((m) =>
              m.id === item.id
                ? { ...m, id: savedMedia.id, uploading: false, uploaded: true, savedId: savedMedia.id }
                : m,
            ),
          );
        }
      } catch (error) {
        setMedia((prev) =>
          prev.map((m) =>
            m.id === item.id ? { ...m, uploading: false, uploadError: String(error) } : m,
          ),
        );
      }
    },
    [procedureCode],
  );

  const deleteMediaById = useCallback(async (mediaId: string) => {
    await apiCall<{ success: boolean }>(
      `/api/procedures/execution/media?id=${encodeURIComponent(mediaId)}`,
      { method: "DELETE" },
    );
  }, []);

  const addMedia = useCallback(
    (item: Omit<CreationMediaItem, "id">) => {
      const full: CreationMediaItem = {
        ...item,
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      };
      setMedia((prev) => [...prev, full]);

      if (autoUpload) {
        uploadMedia(full);
      }
    },
    [uploadMedia, autoUpload],
  );

  const removeMedia = useCallback(
    (mediaId: string) => {
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
      deleteMediaById(mediaId).catch(() => {});
    },
    [deleteMediaById],
  );

  const uploadAll = useCallback(
    async () => {
      const pending = media.filter((m) => !m.uploaded && !m.uploading);
      await Promise.all(pending.map((m) => uploadMedia(m)));
    },
    [media, uploadMedia],
  );

  const getMediaByStep = useCallback(
    (stepId: string) => {
      return media.filter((m) => m.stepId === stepId);
    },
    [media],
  );

  const clearMedia = useCallback(() => {
    setMedia([]);
  }, []);

  return {
    media,
    addMedia,
    removeMedia,
    uploadMedia,
    uploadAll,
    getMediaByStep,
    clearMedia,
    hasUnuploaded: media.some((m) => !m.uploaded),
  };
}