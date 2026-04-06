"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { User } from "@/lib/types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUser() {
      try {
        const data = await api.auth.me();
        if (!cancelled) {
          setUser(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setUser(null);
          setError(e instanceof Error ? e.message : "Failed to fetch user");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchUser();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading, error };
}
