"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface AccountInfo {
  githubUsername: string;
  avatarUrl: string | null;
}

export function UserMenu() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.accounts) return;
        const active = data.accounts.find((a: { isActive: boolean }) => a.isActive) ?? data.accounts[0];
        if (active) setAccount(active);
      })
      .catch(() => {});
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="flex items-center gap-3">
      {account && (
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            {account.avatarUrl && (
              <AvatarImage src={account.avatarUrl} alt={account.githubUsername} />
            )}
            <AvatarFallback>
              {account.githubUsername.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium hidden sm:inline">
            {account.githubUsername}
          </span>
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={logout}>
        <LogOut className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}
