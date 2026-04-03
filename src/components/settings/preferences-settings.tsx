/**
 * PreferencesSettings — Theme, language, daily study goal (stored in User.preferences).
 */

"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Preferences {
  theme: string;
  language: string;
  dailyGoal: number;
}

const DEFAULT_PREFS: Preferences = {
  theme: "dark",
  language: "vi",
  dailyGoal: 30,
};

export function PreferencesSettings() {
  const { user, refresh } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (user?.preferences) {
      const p = user.preferences as Record<string, unknown>;
      setPrefs({
        theme: (p.theme as string) ?? DEFAULT_PREFS.theme,
        language: (p.language as string) ?? DEFAULT_PREFS.language,
        dailyGoal: (p.dailyGoal as number) ?? DEFAULT_PREFS.dailyGoal,
      });
    }
    setLoaded(true);
  }, [user?.preferences]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (res.ok) {
        toast.success("Đã cập nhật tuỳ chọn");
        await refresh();
      } else {
        toast.error("Cập nhật thất bại");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tuỳ chọn</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Ngôn ngữ</Label>
          <Select
            value={prefs.language}
            onValueChange={(v: string | null) => setPrefs((p) => ({ ...p, language: v ?? p.language }))}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vi">Tiếng Việt</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Mục tiêu học hàng ngày (phút)</Label>
          <Select
            value={String(prefs.dailyGoal)}
            onValueChange={(v: string | null) =>
              setPrefs((p) => ({ ...p, dailyGoal: parseInt(v ?? "30", 10) }))
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 phút</SelectItem>
              <SelectItem value="30">30 phút</SelectItem>
              <SelectItem value="60">60 phút</SelectItem>
              <SelectItem value="120">120 phút</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#A435F0] hover:bg-[#8710D8] text-white cursor-pointer"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            "Lưu tuỳ chọn"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
