"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

interface LearnerProfile {
  level: string;
  goal: string;
  dailyTimeMin: number;
  knownTopicIds: string[];
  learningStyle: string;
}

interface LearnerProfileModalProps {
  open: boolean;
  courseId: string;
  existingProfile?: LearnerProfile | null;
  onClose: () => void;
  onSaved: (profile: LearnerProfile) => void;
}

interface LessonOption {
  id: string;
  title: string;
}

const LEVELS = [
  { value: "beginner", label: "🌱 Người mới bắt đầu", desc: "Chưa biết gì về chủ đề này" },
  { value: "intermediate", label: "📚 Trung cấp", desc: "Đã có kiến thức cơ bản" },
  { value: "advanced", label: "🚀 Nâng cao", desc: "Đã có kinh nghiệm thực tế" },
];

const GOALS = [
  { value: "career_change", label: "💼 Chuyển nghề", desc: "Muốn chuyển sang lĩnh vực mới" },
  { value: "skill_upgrade", label: "📈 Nâng cao kỹ năng", desc: "Cải thiện kỹ năng hiện tại" },
  { value: "hobby", label: "🎨 Sở thích", desc: "Học cho vui, khám phá" },
  { value: "exam_prep", label: "📝 Chuẩn bị thi", desc: "Luyện thi chứng chỉ" },
];

const TIME_OPTIONS = [
  { value: 30, label: "30 phút", desc: "Học nhanh mỗi ngày" },
  { value: 60, label: "1 giờ", desc: "Cân bằng học và làm" },
  { value: 120, label: "2 giờ+", desc: "Học chuyên sâu" },
];

const LEARNING_STYLES = [
  { value: "theory_first", label: "📖 Lý thuyết trước", desc: "Đọc hiểu rồi mới thực hành" },
  { value: "hands_on", label: "🛠️ Thực hành ngay", desc: "Làm trước, học sau" },
  { value: "mixed", label: "🔀 Kết hợp", desc: "Xen kẽ lý thuyết và thực hành" },
];

const TOTAL_STEPS = 5;

export function LearnerProfileModal({
  open,
  courseId,
  existingProfile,
  onClose,
  onSaved,
}: LearnerProfileModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [level, setLevel] = useState(existingProfile?.level || "");
  const [goal, setGoal] = useState(existingProfile?.goal || "");
  const [dailyTimeMin, setDailyTimeMin] = useState(existingProfile?.dailyTimeMin || 0);
  const [knownTopicIds, setKnownTopicIds] = useState<string[]>(existingProfile?.knownTopicIds || []);
  const [learningStyle, setLearningStyle] = useState(existingProfile?.learningStyle || "");

  // Lessons for known topics step
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setStep(1);
      setLevel(existingProfile?.level || "");
      setGoal(existingProfile?.goal || "");
      setDailyTimeMin(existingProfile?.dailyTimeMin || 0);
      setKnownTopicIds(existingProfile?.knownTopicIds || []);
      setLearningStyle(existingProfile?.learningStyle || "");
    }
  }, [open, existingProfile]);

  // Load lessons for known topics
  useEffect(() => {
    if (!open || !courseId) return;
    let cancelled = false;
    const loadLessons = async () => {
      setLessonsLoading(true);
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
        }
      } catch {
        // silent
      }
      if (!cancelled) setLessonsLoading(false);
    };
    loadLessons();
    return () => { cancelled = true; };
  }, [open, courseId]);

  const toggleKnownTopic = (id: string) => {
    setKnownTopicIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!level;
      case 2: return !!goal;
      case 3: return dailyTimeMin > 0;
      case 4: return true; // Known topics is optional
      case 5: return !!learningStyle;
      default: return false;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const profile: LearnerProfile = {
      level,
      goal,
      dailyTimeMin,
      knownTopicIds,
      learningStyle,
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

  const renderOptionButton = (
    value: string,
    label: string,
    desc: string,
    selected: boolean,
    onClick: () => void
  ) => (
    <button
      key={value}
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
        selected
          ? "border-[#A435F0] bg-[#A435F0]/5 ring-1 ring-[#A435F0]/20"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
        {label}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">{desc}</div>
    </button>
  );

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
                  i + 1 <= step ? "bg-[#A435F0]" : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            Bước {step} / {TOTAL_STEPS}
          </p>
        </DialogHeader>

        <div className="py-4 min-h-[200px]">
          {/* Step 1: Level */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                Trình độ hiện tại của bạn?
              </p>
              {LEVELS.map((opt) =>
                renderOptionButton(opt.value, opt.label, opt.desc, level === opt.value, () => setLevel(opt.value))
              )}
            </div>
          )}

          {/* Step 2: Goal */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                Mục tiêu học tập?
              </p>
              {GOALS.map((opt) =>
                renderOptionButton(opt.value, opt.label, opt.desc, goal === opt.value, () => setGoal(opt.value))
              )}
            </div>
          )}

          {/* Step 3: Daily time */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                Thời gian học mỗi ngày?
              </p>
              {TIME_OPTIONS.map((opt) =>
                renderOptionButton(String(opt.value), opt.label, opt.desc, dailyTimeMin === opt.value, () => setDailyTimeMin(opt.value))
              )}
            </div>
          )}

          {/* Step 4: Known topics */}
          {step === 4 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Chủ đề bạn đã biết? (tuỳ chọn)
              </p>
              {lessonsLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-[#A435F0]" />
                  <span className="text-xs text-gray-500">Đang tải...</span>
                </div>
              ) : lessons.length > 0 ? (
                <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                  {lessons.map((lesson) => {
                    const isSelected = knownTopicIds.includes(lesson.id);
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => toggleKnownTopic(lesson.id)}
                        className={`w-full flex items-center gap-2 text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? "border-[#A435F0] bg-[#A435F0]/5"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "bg-[#A435F0] border-[#A435F0]"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                          {lesson.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-400">
                    Nhập chủ đề bạn đã biết (phân cách bằng dấu phẩy):
                  </p>
                  <Input
                    value={knownTopicIds.join(", ")}
                    onChange={(e) => {
                      const topics = e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean);
                      setKnownTopicIds(topics);
                    }}
                    placeholder="VD: HTML, CSS, JavaScript..."
                    className="text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 5: Learning style */}
          {step === 5 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                Phong cách học tập ưa thích?
              </p>
              {LEARNING_STYLES.map((opt) =>
                renderOptionButton(opt.value, opt.label, opt.desc, learningStyle === opt.value, () => setLearningStyle(opt.value))
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {step > 1 && (
            <Button
              onClick={() => setStep(step - 1)}
              variant="outline"
              size="sm"
              className="cursor-pointer text-xs"
            >
              <ChevronLeft className="w-3 h-3 mr-1" />
              Quay lại
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button
              onClick={() => setStep(step + 1)}
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
