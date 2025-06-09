"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "todo-mvc-common";

export function AppProviders({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
