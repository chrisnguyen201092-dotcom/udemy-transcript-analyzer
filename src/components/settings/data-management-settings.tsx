/**
 * DataManagementSettings — Export data, usage stats, delete account.
 */

"use client";

import { useState } from "react";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DataManagementSettings() {
  const { logout } = useAuth();
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
      if (res.ok) {
        toast.success("Tài khoản đã được xoá");
        await logout();
      } else {
        toast.error("Xoá tài khoản thất bại");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Xuất dữ liệu</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Tải xuống tất cả dữ liệu của bạn dưới dạng JSON.
          </p>
          <Button variant="outline" className="gap-2 cursor-pointer" disabled>
            <Download className="h-4 w-4" />
            Xuất dữ liệu (Sắp ra mắt)
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="text-base text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Vùng nguy hiểm
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Xoá tài khoản sẽ xoá vĩnh viễn tất cả khoá học, bài học, ghi chú,
            flashcard và dữ liệu AI của bạn. Hành động này không thể hoàn tác.
          </p>
          <AlertDialog>
            <AlertDialogTrigger>
              <Button variant="destructive" className="gap-2 cursor-pointer">
                <AlertTriangle className="h-4 w-4" />
                Xoá tài khoản
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bạn chắc chắn muốn xoá?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tất cả dữ liệu sẽ bị xoá vĩnh viễn. Bạn không thể khôi phục
                  lại sau khi xoá.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">Huỷ</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 cursor-pointer"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang xoá...
                    </>
                  ) : (
                    "Xoá vĩnh viễn"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
