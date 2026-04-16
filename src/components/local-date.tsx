"use client";

import { useEffect, useState } from "react";

import { formatDate } from "@/lib/utils";

export function LocalDate({ iso }: { iso: string }) {
  const [text, setText] = useState(() => formatDate(iso));
  useEffect(() => {
    setText(formatDate(iso));
  }, [iso]);
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
