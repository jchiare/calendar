"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import HouseholdSetup from "./household-setup";

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  const household = useQuery(api.household.getHousehold);

  // Loading
  if (household === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  // No household yet — show onboarding inline
  if (household === null) {
    return <HouseholdSetup />;
  }

  // Household exists — render the calendar page
  return <>{children}</>;
}
