"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const household = useQuery(api.household.getHousehold);

  useEffect(() => {
    if (household === undefined) return; // still loading
    if (household === null) {
      router.replace("/setup");
    } else {
      router.replace("/calendar");
    }
  }, [household, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>
  );
}
