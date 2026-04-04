"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { TOTAL_STEPS } from "@/lib/learner-profile-constants";
import { LearnerProfileWizardStep } from "@/components/LearnerProfileWizardStep";

interface LearnerProfile {
  level: string;
  goal: string;
  dailyTimeMin: number;
  knownTopics: string[];
  learningStyle: string;
}

interface LearnerProfileModalProps {
  open: boolean;
  courseId: string;
  existingProfile?: LearnerProfile | null;
  onClose: () => void;
  onSaved: (profile: LearnerProfile) => void;
}

interface FormState {
  step: number;
  level: string;
  goal: string;
  dailyTimeMin: number;
  knownTopics: string[];
  learningStyle: string;
}

function initialForm(profile?: LearnerProfile | null): FormState {
  return {
    step: 1,
    level: profile?.level || "",
    goal: profile?.goal || "",
    dailyTimeMin: profile?.dailyTimeMin || 0,
    knownTopics: profile?.knownTopics || [],
    learningStyle: profile?.learningStyle || "",
  };
}

export function LearnerProfileModal({
  open,
  courseId,
  existingProfile,
  onClose,
  onSaved,
}: LearnerProfileModalProps) {
  const [form, setForm] = useState<FormState>(() => initialForm(existingProfile));
  const [lastOpenState, setLastOpenState] = useState(open);
  const [saving, setSaving] = useState(false);

  // Reset form when modal transitions from closed to open (render-time derived state)
  if (open && !lastOpenState) {
    setLastOpenState(true);
    setForm(initialForm(existingProfile));
  } else if (!open && lastOpenState) {
    setLastOpenState(false);
  }

  // Lessons for known topics step
  const [lessons, setLessons] = useState<{ id: string; title: string }[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [lessonLoadError, setLessonLoadError] = useState<string | null>(null);

  // Load lessons for known topics
  useEffect(() => {
    if (!open || !courseId) return;
    let cancelled = false;
    const loadLessons = async () => {
      setLessonsLoading(true);
      setLessonLoadError(null);
      try {
        const res = await fetch(`/api/courses/${courseId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.lessons) {
            setLessons(
              data.lessons.map((l: { id: string; title: string }) => ({
                id: l.id,
                title: l.title,
              }))
            );
          }
        } else if (!cancelled) {
          setLessonLoadError("Failed to load lessons. Please try again.");
        }
      } catch {
        if (!cancelled) {
          setLessonLoadError("Failed to load lessons. Please try again.");
        }
      }
      if (!cancelled) setLessonsLoading(false);
    };
    loadLessons();
    return () => { cancelled = true; };
  }, [open, courseId]);

  const toggleKnownTopic = (id: string) => {
    setForm((prev) => ({
      ...prev,
      knownTopics: prev.knownTopics.includes(id)
        ? prev.knownTopics.filter((t) => t !== id)
        : [...prev.knownTopics, id],
    }));
  };

  const canProceed = () => {
    switch (form.step) {
      case 1: return !!form.level;
      case 2: return !!form.goal;
      case 3: return form.dailyTimeMin > 0;
      case 4: return true; // Known topics is optional
      case 5: return !!form.learningStyle;
      default: return false;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const profile: LearnerProfile = {
      level: form.level,
      goal: form.goal,
      dailyTimeMin: form.dailyTimeMin,
      knownTopics: form.knownTopics,
      learningStyle: form.learningStyle,
    };

    try {
      const method = existingProfile ? "PUT" : "POST";
      const res = await fetch(`/api/courses/${courseId}/profile`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        onSaved(profile);
        onClose();
      } else {
        toast.error("Lỗi khi lưu hồ sơ");
      }
    } catch {
      toast.error("Lỗi khi lưu hồ sơ");
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            Hồ sơ học viên
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mt-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i + 1 <= form.step ? "bg-[#A435F0]" : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            Bước {form.step} / {TOTAL_STEPS}
          </p>
        </DialogHeader>

        <LearnerProfileWizardStep
          step={form.step}
          level={form.level}
          goal={form.goal}
          dailyTimeMin={form.dailyTimeMin}
          learningStyle={form.learningStyle}
          knownTopics={form.knownTopics}
          lessons={lessons}
          lessonsLoading={lessonsLoading}
          lessonLoadError={lessonLoadError}
          onSetLevel={(v) => setForm((p) => ({ ...p, level: v }))}
          onSetGoal={(v) => setForm((p) => ({ ...p, goal: v }))}
          onSetDailyTimeMin={(v) => setForm((p) => ({ ...p, dailyTimeMin: v }))}
          onSetLearningStyle={(v) => setForm((p) => ({ ...p, learningStyle: v }))}
          onToggleKnownTopic={toggleKnownTopic}
          onSetKnownTopics={(v) => setForm((p) => ({ ...p, knownTopics: v }))}
        />

        <DialogFooter className="flex gap-2">
          {form.step > 1 && (
            <Button
              onClick={() => setForm((p) => ({ ...p, step: p.step - 1 }))}
              variant="outline"
              size="sm"
              className="cursor-pointer text-xs"
            >
              <ChevronLeft className="w-3 h-3 mr-1" />
              Quay lại
            </Button>
          )}
          {form.step < TOTAL_STEPS ? (
            <Button
              onClick={() => setForm((p) => ({ ...p, step: p.step + 1 }))}
              disabled={!canProceed()}
              size="sm"
              className="cursor-pointer bg-[#A435F0] hover:bg-[#8710D8] text-white text-xs ml-auto"
            >
              Tiếp theo
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={!canProceed() || saving}
              size="sm"
              className="cursor-pointer bg-[#A435F0] hover:bg-[#8710D8] text-white text-xs ml-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  Đang lưu...
                </>
              ) : existingProfile ? (
                "Cập nhật"
              ) : (
                "Hoàn thành"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
