/**
 * EmptyDashboard — First-time user onboarding CTA.
 */

"use client";

import Link from "next/link";
import { BookOpen, Upload, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function EmptyDashboard() {
  const steps = [
    {
      icon: Upload,
      title: "Thêm khoá học",
      description: "Upload transcript, paste URL, hoặc nhập nội dung",
    },
    {
      icon: BookOpen,
      title: "Học qua AI",
      description: "AI tóm tắt, giải thích, tạo quiz và flashcard tự động",
    },
    {
      icon: Sparkles,
      title: "Ôn tập thông minh",
      description: "Hệ thống SRS giúp bạn ghi nhớ lâu dài",
    },
  ];

  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="mb-8">
        <div className="w-16 h-16 rounded-2xl bg-[#A435F0]/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-[#A435F0]" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Bắt đầu hành trình học tập
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Inkgest giúp bạn học hiệu quả hơn với AI
        </p>
      </div>

      <div className="grid gap-4 mb-8">
        {steps.map((step) => (
          <Card key={step.title}>
            <CardContent className="flex items-start gap-4 py-4">
              <div className="w-10 h-10 rounded-lg bg-[#A435F0]/10 flex items-center justify-center shrink-0">
                <step.icon className="w-5 h-5 text-[#A435F0]" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Link href="/">
        <Button className="bg-[#A435F0] hover:bg-[#8710D8] text-white cursor-pointer">
          Thêm khoá học đầu tiên
        </Button>
      </Link>
      <Link href="/?openUploadBook=1" className="block mt-3">
        <Button variant="outline" className="gap-2 cursor-pointer border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30">
          <BookOpen className="w-4 h-4" />
          Upload sách (EPUB/PDF)
        </Button>
      </Link>
    </div>
  );
}
