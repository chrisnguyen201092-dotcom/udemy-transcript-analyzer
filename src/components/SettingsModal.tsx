"use client";

import { useCallback, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  udemyCookie: string;
}

interface SettingsModalProps {
  open: boolean;
  initialSettings: AISettings;
  onSave: (settings: AISettings) => void;
  onClose: () => void;
}

export function SettingsModal({ open, initialSettings, onSave, onClose }: SettingsModalProps) {
  const [draft, setDraft] = useState<AISettings>(initialSettings);
  const [models, setModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");

  const fetchModels = useCallback(async (s: AISettings) => {
    if (!s.baseUrl || !s.apiKey) return;
    setFetchingModels(true);
    setModelsError("");
    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: s.baseUrl, apiKey: s.apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModelsError(data.error ?? "Failed to fetch models");
        setModels([]);
      } else {
        setModels(data.models ?? []);
        if (data.models?.length && !data.models.includes(s.model)) {
          setDraft((prev) => ({ ...prev, model: data.models[0] }));
        }
      }
    } catch {
      setModelsError("Network error");
    } finally {
      setFetchingModels(false);
    }
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setDraft(initialSettings);
      setModels([]);
      setModelsError("");
      if (initialSettings.baseUrl && initialSettings.apiKey) {
        fetchModels(initialSettings);
      }
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI Settings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Base URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              value={draft.baseUrl}
              onChange={(e) => setDraft((p) => ({ ...p, baseUrl: e.target.value }))}
              placeholder="https://api.openai.com/v1"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500">
            </p>
          </div>

          {/* API Key */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft((p) => ({ ...p, apiKey: e.target.value }))}
              placeholder="sk-..."
            />
          </div>

          <Separator />

          {/* Udemy section */}
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide -mb-1">
            Udemy Import
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="udemyCookie">
              Udemy Cookie{" "}
              <span className="text-slate-400 dark:text-slate-500 font-normal">(access_token)</span>
            </Label>
            <Input
              id="udemyCookie"
              type="password"
              value={draft.udemyCookie}
              onChange={(e) => setDraft((p) => ({ ...p, udemyCookie: e.target.value }))}
              placeholder="Paste access_token từ udemy.com..."
            />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              F12 → Application → Cookies → udemy.com → copy giá trị{" "}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">access_token</code>
            </p>
          </div>

          {/* Fetch models */}
          <Button
            variant="outline"
            onClick={() => fetchModels(draft)}
            disabled={fetchingModels || !draft.baseUrl || !draft.apiKey}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${fetchingModels ? "animate-spin" : ""}`} />
            {fetchingModels ? "Đang tải models..." : "Lấy danh sách Models"}
          </Button>

          {modelsError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">
              {modelsError}
            </p>
          )}

          {/* Model selector */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model">Model</Label>
            {models.length > 0 ? (
              <Select
                value={draft.model}
                onValueChange={(val) => setDraft((p) => ({ ...p, model: val ?? "" }))}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder="— chọn model —" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="model"
                value={draft.model}
                onChange={(e) => setDraft((p) => ({ ...p, model: e.target.value }))}
                placeholder="gpt-4o (nhập tay hoặc tải danh sách)"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="cursor-pointer">
            Huỷ
          </Button>
          <Button
            onClick={() => onSave(draft)}
            disabled={!draft.apiKey || !draft.model}
            className="cursor-pointer bg-[#A435F0] hover:bg-[#8710D8]"
          >
            Lưu Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
