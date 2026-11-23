"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@heroui/react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button
      isIconOnly
      variant="ghost"
      size="sm"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onPress={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </Button>
  );
}
