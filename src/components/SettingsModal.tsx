"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ProfileSidebar } from "@/components/ProfileSidebar";
import { ProfileFormPanel } from "@/components/ProfileFormPanel";
import {
  type AIProfile,
  type SettingsStore,
  makeProfile,
  loadStore,
  saveStore,
  activeProfile,
} from "@/lib/settings-store";

// Re-export for backward compatibility with other modules that import from here
export type { AIProfile, SettingsStore };
export { makeProfile, loadStore, saveStore, activeProfile };

// ── Component Props ───────────────────────────────────────────────────────────

interface SettingsModalProps {
  open: boolean;
  store: SettingsStore;
  onSave: (store: SettingsStore) => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SettingsModal({ open, store, onSave, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState<SettingsStore>(store);
  const [selectedId, setSelectedId] = useState<string>(store.activeId || store.profiles[0]?.id || "");
  const [editingName, setEditingName] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{status: 'idle' | 'loading' | 'success' | 'error', message?: string}>({status: 'idle'});

  // Sync when modal opens
  useEffect(() => {
    if (open) {
      setDraft(store);
      setSelectedId(store.activeId || store.profiles[0]?.id || "");
      setEditingName(false);
      setModelsError("");
      setUrlError(null);
      setTestResult({ status: 'idle' });
    }
  }, [open, store]);

  const selectedProfile = draft.profiles.find((p) => p.id === selectedId) ?? draft.profiles[0];

  const updateProfile = (changes: Partial<AIProfile>) => {
    if ('baseUrl' in changes || 'apiKey' in changes || 'model' in changes) {
      setTestResult({ status: 'idle' });
    }
    if ('baseUrl' in changes) {
      setUrlError(null);
    }
    setDraft((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === selectedId ? { ...p, ...changes } : p
      ),
    }));
  };

  const validateUrl = (url: string): string | null => {
    if (!url) return "Base URL is required";
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return "URL must start with http:// or https://";
    }
    try {
      new URL(url);
      return null;
    } catch {
      return "Invalid URL format";
    }
  };

  const handleUrlBlur = () => {
    const error = validateUrl(selectedProfile.baseUrl);
    setUrlError(error);
  };

  const handleTestConnection = async () => {
    setTestResult({ status: 'loading' });
    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: selectedProfile.baseUrl, apiKey: selectedProfile.apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestResult({ status: 'error', message: data.error ?? "Connection failed" });
      } else {
        setTestResult({ status: 'success', message: "Connection successful" });
      }
    } catch {
      setTestResult({ status: 'error', message: "Network error" });
    }
  };

  const addProfile = () => {
    const p = makeProfile({ name: `Profile ${draft.profiles.length + 1}` });
    setDraft((prev) => ({ ...prev, profiles: [...prev.profiles, p] }));
    setSelectedId(p.id);
    setModelsError("");
    setUrlError(null);
    setTestResult({ status: 'idle' });
  };

  const deleteProfile = (id: string) => {
    if (draft.profiles.length <= 1) return; // keep at least 1
    const remaining = draft.profiles.filter((p) => p.id !== id);
    const newActiveId = draft.activeId === id ? remaining[0].id : draft.activeId;
    setDraft({ profiles: remaining, activeId: newActiveId });
    if (selectedId === id) {
      setSelectedId(remaining[0].id);
    }
    setModelsError("");
    setUrlError(null);
    setTestResult({ status: 'idle' });
  };

  const handleProfileSwitch = (id: string) => {
    setSelectedId(id);
    setEditingName(false);
    setModelsError("");
    setTestResult({ status: 'idle' });
  };

  const fetchModels = useCallback(async (profile: AIProfile) => {
    if (!profile.baseUrl || !profile.apiKey) return;
    setFetchingModels(true);
    setModelsError("");
    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: profile.baseUrl, apiKey: profile.apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModelsError(data.error ?? "Failed to fetch models");
        updateProfile({ cachedModels: [] });
      } else {
        const models: string[] = data.models ?? [];
        updateProfile({
          cachedModels: models,
          model: models.includes(profile.model) ? profile.model : (models[0] ?? profile.model),
        });
      }
    } catch {
      setModelsError("Network error");
    } finally {
      setFetchingModels(false);
    }
    // Intentionally depends only on selectedId: fetchModels re-creates when the selected
    // profile changes. updateProfile is an inline fn that calls stable setDraft — adding
    // it would cause an infinite loop (draft change → new updateProfile → new fetchModels).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleSave = () => {
    // Active profile = the one currently selected in the sidebar
    onSave({ ...draft, activeId: selectedId });
    toast.success("Đã lưu cài đặt");
  };

  if (!selectedProfile) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
        <div className="flex h-[520px]">

          {/* ── Sidebar: Profile list ─────────────────────────────── */}
          <ProfileSidebar
            profiles={draft.profiles}
            selectedId={selectedId}
            activeId={draft.activeId}
            onSelect={handleProfileSwitch}
            onDelete={deleteProfile}
            onAdd={addProfile}
          />

          {/* ── Main: Profile form ────────────────────────────────── */}
          <ProfileFormPanel
            profile={selectedProfile}
            selectedId={selectedId}
            activeId={draft.activeId}
            editingName={editingName}
            urlError={urlError}
            fetchingModels={fetchingModels}
            modelsError={modelsError}
            testResult={testResult}
            onUpdateProfile={updateProfile}
            onSetEditingName={setEditingName}
            onSetActive={() => setDraft((prev) => ({ ...prev, activeId: selectedId }))}
            onUrlBlur={handleUrlBlur}
            onFetchModels={() => fetchModels(selectedProfile)}
            onTestConnection={handleTestConnection}
            onSave={handleSave}
            onClose={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
