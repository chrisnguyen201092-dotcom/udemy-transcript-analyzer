/**
 * Settings page — Tabbed layout: Account, Preferences, Data Management.
 * Tab state persisted in URL via ?tab= for deep-linking support.
 */

"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { User, Settings, Database } from "lucide-react";
import { AccountSettings } from "@/components/settings/account-settings";
import { PreferencesSettings } from "@/components/settings/preferences-settings";
import { DataManagementSettings } from "@/components/settings/data-management-settings";

type Tab = "account" | "preferences" | "data";

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "account", label: "Tài khoản", icon: User },
  { id: "preferences", label: "Tuỳ chọn", icon: Settings },
  { id: "data", label: "Dữ liệu", icon: Database },
];

const validTabs = new Set<string>(["account", "preferences", "data"]);

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const activeTab: Tab = validTabs.has(tabParam ?? "") ? (tabParam as Tab) : "account";

  function setActiveTab(tab: Tab) {
    router.replace(`/settings?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
        Cài đặt
      </h1>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "border-[#A435F0] text-[#A435F0]"
                : "border-transparent text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "account" && <AccountSettings />}
      {activeTab === "preferences" && <PreferencesSettings />}
      {activeTab === "data" && <DataManagementSettings />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
