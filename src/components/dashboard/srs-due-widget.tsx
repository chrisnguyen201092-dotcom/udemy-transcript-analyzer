/**
 * SrsDueWidget — Shows flashcard review count and start button.
 */

"use client";

import { Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SrsDueWidgetProps {
  count: number;
}

export function SrsDueWidget({ count }: SrsDueWidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Brain className="h-4 w-4 text-[#A435F0]" />
          Ôn tập hôm nay
        </CardTitle>
      </CardHeader>
      <CardContent>
        {count > 0 ? (
          <div className="text-center py-4">
            <p className="text-4xl font-bold text-[#A435F0]">{count}</p>
            <p className="text-sm text-muted-foreground mt-1">
              flashcard cần ôn tập
            </p>
            <Button
              className="mt-4 bg-[#A435F0] hover:bg-[#8710D8] text-white cursor-pointer"
              size="sm"
            >
              Bắt đầu ôn tập
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Không có flashcard nào cần ôn tập hôm nay
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tiếp tục học để tạo flashcard mới
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
