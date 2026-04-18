"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Download, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";

export default function PrivacySettingsPage() {
  const router = useRouter();

  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "socialbharat-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error("Data export failed", err);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDelete() {
    if (deleteInput !== "DELETE MY ACCOUNT") {
      setDeleteError('Please type "DELETE MY ACCOUNT" exactly to confirm.');
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE MY ACCOUNT" }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Deletion failed");
      }
      router.push("/login");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Deletion failed");
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Privacy &amp; Data
        </h1>
        <p className="text-slate-500 mt-1">
          Manage your personal data in accordance with the DPDP Act, 2023.
        </p>
      </div>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export My Data
          </CardTitle>
          <CardDescription>
            Download a copy of all your data stored on SocialBharat as a JSON
            file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            variant="outline"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Downloading&hellip;
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export My Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Account
            </Button>
          ) : (
            <div className="space-y-4 border border-red-200 rounded-lg p-4 bg-red-50">
              <div className="flex items-start gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                <p className="text-sm">
                  Warning: This will permanently delete your account, posts, and
                  all associated data.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type <strong>DELETE MY ACCOUNT</strong> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="DELETE MY ACCOUNT"
                  className="border-red-300 focus-visible:ring-red-400"
                />
              </div>
              {deleteError && (
                <p className="text-sm text-red-600">{deleteError}</p>
              )}
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting&hellip;
                    </>
                  ) : (
                    "Permanently Delete Account"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteInput("");
                    setDeleteError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
