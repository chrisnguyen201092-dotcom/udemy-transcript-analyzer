"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Plus, Trash2, Check, Pencil, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AIProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  udemyCookie: string;
  cachedModels: string[];
}

export interface SettingsStore {
  profiles: AIProfile[];
  activeId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function makeProfile(overrides: Partial<AIProfile> = {}): AIProfile {
  return {
    id: crypto.randomUUID(),
    name: "New Profile",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "",
    udemyCookie: "",
    cachedModels: [],
    ...overrides,
  };
}

const DEFAULT_STORE: SettingsStore = {
  profiles: [makeProfile({ name: "Default" })],
  activeId: "",
};

export function loadStore(): SettingsStore {
  if (typeof window === "undefined") return DEFAULT_STORE;
  try {
    const raw = localStorage.getItem("udemy_ai_profiles");
    if (!raw) {
      // Migrate legacy single-profile settings
      const legacy = localStorage.getItem("udemy_ai_settings");
      if (legacy) {
        const parsed = JSON.parse(legacy) as Partial<AIProfile>;
        const profile = makeProfile({
          name: "Default",
          ...parsed,
          cachedModels: [],
        });
        return { profiles: [profile], activeId: profile.id };
      }
      return DEFAULT_STORE;
    }
    const store = JSON.parse(raw) as SettingsStore;
    // Ensure all profiles have cachedModels
    store.profiles = store.profiles.map((p) => ({
      ...p,
      cachedModels: p.cachedModels ?? [],
    }));
    return store;
  } catch {
    return DEFAULT_STORE;
  }
}

export function saveStore(store: SettingsStore) {
  localStorage.setItem("udemy_ai_profiles", JSON.stringify(store));
}

export function activeProfile(store: SettingsStore): AIProfile {
  return (
    store.profiles.find((p) => p.id === store.activeId) ??
    store.profiles[0] ??
    makeProfile()
  );
}

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
          <div className="w-48 shrink-0 border-r border-gray-100 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900">
            <DialogHeader className="px-3 pt-4 pb-2">
              <DialogTitle className="text-sm">AI Profiles</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-2 flex flex-col gap-1">
              {draft.profiles.map((p) => (
                <div
                  key={p.id}
                  onClick={() => { setSelectedId(p.id); setEditingName(false); setModelsError(""); }}
                  className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-2 cursor-pointer text-xs transition-colors ${
                    p.id === selectedId
                      ? "bg-[#A435F0] text-white"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {/* Active indicator */}
                  {p.id === draft.activeId && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        p.id === selectedId ? "bg-white" : "bg-emerald-500"
                      }`}
                    />
                  )}
                  <span className="flex-1 truncate font-medium">{p.name}</span>

                  {/* Delete button */}
                  {draft.profiles.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteProfile(p.id); }}
                      className={`opacity-0 group-hover:opacity-100 shrink-0 rounded p-0.5 transition-opacity ${
                        p.id === selectedId
                          ? "hover:bg-white/20 text-white"
                          : "hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400"
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="p-2 border-t border-gray-100 dark:border-gray-800">
              <Button
                variant="outline"
                size="sm"
                onClick={addProfile}
                className="w-full gap-1.5 text-xs h-7 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Thêm profile
              </Button>
            </div>
          </div>

          {/* ── Main: Profile form ────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Profile name header */}
            <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
              {editingName ? (
                <Input
                  autoFocus
                  value={selectedProfile.name}
                  onChange={(e) => updateProfile({ name: e.target.value })}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => { if (e.key === "Enter") setEditingName(false); }}
                  className="h-7 text-sm font-semibold flex-1"
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="flex items-center gap-1.5 group"
                >
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {selectedProfile.name}
                  </span>
                  <Pencil className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}

              {/* "Set as active" button */}
              <Button
                size="sm"
                variant={selectedId === draft.activeId ? "default" : "outline"}
                onClick={() => setDraft((prev) => ({ ...prev, activeId: selectedId }))}
                className={`ml-auto h-7 text-xs gap-1.5 cursor-pointer ${
                  selectedId === draft.activeId
                    ? "bg-emerald-500 hover:bg-emerald-600 text-white border-transparent"
                    : ""
                }`}
              >
                <Check className="w-3 h-3" />
                {selectedId === draft.activeId ? "Đang dùng" : "Dùng profile này"}
              </Button>
            </div>

            {/* Form fields */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {/* Base URL */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="baseUrl" className="text-xs">
                  Base URL <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="baseUrl"
                  value={selectedProfile.baseUrl}
                  onChange={(e) => updateProfile({ baseUrl: e.target.value })}
                  onBlur={handleUrlBlur}
                  placeholder="https://api.openai.com/v1"
                  className="text-sm"
                />
                {urlError && <p className="text-[11px] text-red-500 mt-0.5">{urlError}</p>}
              </div>

              {/* API Key */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="apiKey" className="text-xs">
                  API Key <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={selectedProfile.apiKey}
                  onChange={(e) => updateProfile({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="text-sm"
                />
              </div>

              <Separator />

              {/* Udemy section */}
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide -mb-1">
                Udemy Import
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="udemyCookie" className="text-xs">
                  Udemy Cookie{" "}
                  <span className="text-slate-400 font-normal">(access_token)</span>
                </Label>
                <Input
                  id="udemyCookie"
                  type="password"
                  value={selectedProfile.udemyCookie}
                  onChange={(e) => updateProfile({ udemyCookie: e.target.value })}
                  placeholder="Paste access_token từ udemy.com..."
                  className="text-sm"
                />
                <p className="text-xs text-slate-400">
                  F12 → Application → Cookies → udemy.com → copy giá trị{" "}
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">access_token</code>
                </p>
              </div>

              {/* Fetch models */}
              <Button
                variant="outline"
                onClick={() => fetchModels(selectedProfile)}
                disabled={fetchingModels || !selectedProfile.baseUrl || !selectedProfile.apiKey}
                className="gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${fetchingModels ? "animate-spin" : ""}`} />
                {fetchingModels ? "Đang tải models..." : "Lấy danh sách Models"}
              </Button>

              {/* Test Connection */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testResult.status === 'loading' || !selectedProfile.baseUrl || !selectedProfile.apiKey}
                  className="gap-2 cursor-pointer flex-1"
                >
                  {testResult.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {testResult.status === 'success' && <Check className="w-4 h-4 text-green-600" />}
                  {testResult.status === 'error' && <X className="w-4 h-4 text-red-600" />}
                  {testResult.status === 'idle' && "Test Connection"}
                  {testResult.status === 'loading' && "Testing..."}
                  {testResult.status === 'success' && "Success"}
                  {testResult.status === 'error' && "Failed"}
                </Button>
              </div>
              {testResult.status === 'error' && testResult.message && (
                <p className="text-[11px] text-red-500 mt-0.5">{testResult.message}</p>
              )}

              {modelsError && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">
                  {modelsError}
                </p>
              )}

              {/* Model selector */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="model" className="text-xs">
                  Model <span className="text-red-500">*</span>
                </Label>
                {selectedProfile.cachedModels.length > 0 ? (
                  <Select
                    value={selectedProfile.model}
                    onValueChange={(val) => updateProfile({ model: val ?? "" })}
                  >
                    <SelectTrigger id="model">
                      <SelectValue placeholder="— chọn model —" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProfile.cachedModels.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="model"
                    value={selectedProfile.model}
                    onChange={(e) => updateProfile({ model: e.target.value })}
                    placeholder="gpt-4o (nhập tay hoặc tải danh sách)"
                    className="text-sm"
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-gray-800">
              <Button variant="outline" onClick={onClose} className="cursor-pointer">
                Huỷ
              </Button>
              <Button
                onClick={handleSave}
                disabled={!selectedProfile.apiKey || !selectedProfile.model}
                className="cursor-pointer bg-[#A435F0] hover:bg-[#8710D8]"
              >
                Lưu Settings
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
