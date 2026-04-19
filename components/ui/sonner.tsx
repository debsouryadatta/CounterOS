"use client";

import * as React from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      closeButton
      expand
      gap={12}
      offset={28}
      position="top-right"
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "group rounded-[22px] border border-border bg-card px-4 py-3 text-card-foreground shadow-[0_24px_70px_rgba(42,48,56,0.18)]",
          title: "text-sm font-semibold leading-5 tracking-normal text-card-foreground",
          description: "mt-1 text-sm leading-6 text-muted-foreground",
          content: "min-w-0",
          icon: "text-primary",
          closeButton:
            "border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          actionButton:
            "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/92",
          cancelButton:
            "rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted",
          success: "border-emerald-200 bg-emerald-50 text-emerald-950",
          error: "border-red-200 bg-red-50 text-red-950",
          warning: "border-amber-200 bg-amber-50 text-amber-950",
          info: "border-sky-200 bg-sky-50 text-sky-950",
          loading: "border-primary/20 bg-[#efedff] text-[#302d45]"
        }
      }}
      {...props}
    />
  );
}

export { Toaster };
