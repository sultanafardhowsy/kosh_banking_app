"use client";

import { useRouter } from "next/navigation";
import { Avatar, Dropdown } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { clearUser, selectUser } from "@/store/slices/authSlice";
import { baseApi } from "@/store/api/baseApi";
import { ROLE_LABEL } from "./nav";

export function UserMenu() {
  const user = useAppSelector(selectUser);
  const dispatch = useAppDispatch();
  const router = useRouter();
  if (!user) return null;

  async function handleAction(key: React.Key) {
    if (key === "profile") router.push(user!.role === "CUSTOMER" ? "/profile" : "#");
    if (key === "logout") {
      await authClient.signOut();
      dispatch(clearUser());
      dispatch(baseApi.util.resetApiState()); // drop every cached response
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-xl px-1.5 py-1 outline-none hover:bg-kosh-subtle focus-visible:ring-2 focus-visible:ring-kosh-info"
      >
        <Avatar size="sm">
          <Avatar.Fallback className="bg-kosh-navy text-xs font-semibold text-kosh-navy-fg">{initials(user.name)}</Avatar.Fallback>
        </Avatar>
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block text-xs text-kosh-muted">{ROLE_LABEL[user.role]}</span>
        </span>
        <ChevronDown className="hidden size-4 text-kosh-muted lg:block" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-52">
        <Dropdown.Menu onAction={handleAction}>
          <Dropdown.Item id="who" textValue={user.email} isDisabled>
            <span className="text-xs text-kosh-muted">{user.email}</span>
          </Dropdown.Item>
          {user.role === "CUSTOMER" ? (
            <Dropdown.Item id="profile" textValue="Profile & PIN">
              Profile & PIN
            </Dropdown.Item>
          ) : null}
          <Dropdown.Item id="logout" textValue="Sign out" variant="danger">
            Sign out
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
