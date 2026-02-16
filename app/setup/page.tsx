"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";

const MEMBER_COLORS = [
  { name: "indigo", bg: "bg-indigo-500", ring: "ring-indigo-300" },
  { name: "rose", bg: "bg-rose-500", ring: "ring-rose-300" },
  { name: "amber", bg: "bg-amber-500", ring: "ring-amber-300" },
  { name: "emerald", bg: "bg-emerald-500", ring: "ring-emerald-300" },
  { name: "cyan", bg: "bg-cyan-500", ring: "ring-cyan-300" },
  { name: "purple", bg: "bg-purple-500", ring: "ring-purple-300" },
  { name: "orange", bg: "bg-orange-500", ring: "ring-orange-300" },
  { name: "teal", bg: "bg-teal-500", ring: "ring-teal-300" },
];

const EMOJI_OPTIONS = ["👤", "👩", "👨", "👧", "👦", "👶", "🧑", "👵", "👴", "🐕", "🐱"];

type MemberDraft = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

export default function SetupPage() {
  const router = useRouter();
  const household = useQuery(api.household.getHousehold);
  const setupHousehold = useMutation(api.household.setupHousehold);

  const [step, setStep] = useState<"name" | "members" | "done">("name");
  const [householdName, setHouseholdName] = useState("");
  const [members, setMembers] = useState<MemberDraft[]>([
    { id: "1", name: "", emoji: "👤", color: "indigo" },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  // If household already exists, redirect
  if (household !== undefined && household !== null) {
    router.replace("/calendar");
    return null;
  }

  const addMember = () => {
    const usedColors = new Set(members.map((m) => m.color));
    const nextColor = MEMBER_COLORS.find((c) => !usedColors.has(c.name))?.name ?? "indigo";
    setMembers([
      ...members,
      {
        id: String(Date.now()),
        name: "",
        emoji: "👤",
        color: nextColor,
      },
    ]);
  };

  const removeMember = (id: string) => {
    if (members.length <= 1) return;
    setMembers(members.filter((m) => m.id !== id));
  };

  const updateMember = (id: string, field: keyof MemberDraft, value: string) => {
    setMembers(members.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const handleFinish = useCallback(async () => {
    const validMembers = members.filter((m) => m.name.trim());
    if (!householdName.trim() || validMembers.length === 0) return;

    setIsSaving(true);
    try {
      await setupHousehold({
        householdName: householdName.trim(),
        members: validMembers.map((m) => ({
          name: m.name.trim(),
          emoji: m.emoji,
          color: m.color,
        })),
      });
      setStep("done");
      // Short delay then redirect
      setTimeout(() => router.push("/calendar"), 1200);
    } catch {
      setIsSaving(false);
    }
  }, [householdName, members, setupHousehold, router]);

  // Loading state while checking for existing household
  if (household === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Set up your household</h1>
          <p className="mt-2 text-sm text-slate-500">
            Your AI-powered household calendar. Everyone in one place.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div
            className={`h-2 w-12 rounded-full transition-colors ${
              step === "name" ? "bg-indigo-600" : "bg-indigo-200"
            }`}
          />
          <div
            className={`h-2 w-12 rounded-full transition-colors ${
              step === "members" ? "bg-indigo-600" : step === "done" ? "bg-indigo-200" : "bg-slate-200"
            }`}
          />
        </div>

        {step === "name" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block text-sm font-medium text-slate-700">
              What should we call your household?
            </label>
            <input
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder='e.g. "The Johnsons" or "Apartment 4B"'
              autoFocus
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && householdName.trim()) {
                  setStep("members");
                }
              }}
            />
            <button
              onClick={() => setStep("members")}
              disabled={!householdName.trim()}
              className="mt-4 w-full cursor-pointer rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-default disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}

        {step === "members" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-700">
              Who lives in <span className="font-semibold text-slate-900">{householdName}</span>?
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Add everyone who shares this calendar. You can always add more later.
            </p>

            <div className="mt-4 space-y-3">
              {members.map((member, index) => (
                <div
                  key={member.id}
                  className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                >
                  {/* Emoji picker */}
                  <div className="relative">
                    <EmojiPicker
                      selected={member.emoji}
                      onChange={(emoji) => updateMember(member.id, "emoji", emoji)}
                    />
                  </div>

                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => updateMember(member.id, "name", e.target.value)}
                      placeholder={index === 0 ? "Your name" : "Name"}
                      autoFocus={index === members.length - 1}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none"
                    />

                    {/* Color picker */}
                    <div className="flex gap-1.5">
                      {MEMBER_COLORS.map((c) => (
                        <button
                          key={c.name}
                          onClick={() => updateMember(member.id, "color", c.name)}
                          className={`h-5 w-5 cursor-pointer rounded-full ${c.bg} transition-all ${
                            member.color === c.name
                              ? `ring-2 ${c.ring} ring-offset-1`
                              : "opacity-50 hover:opacity-80"
                          }`}
                          aria-label={c.name}
                        />
                      ))}
                    </div>
                  </div>

                  {members.length > 1 && (
                    <button
                      onClick={() => removeMember(member.id)}
                      className="mt-1 cursor-pointer rounded-full p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                      aria-label="Remove member"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {members.length < 8 && (
              <button
                onClick={addMember}
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-500 transition-colors hover:border-indigo-300 hover:text-indigo-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add another person
              </button>
            )}

            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={() => setStep("name")}
                className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                onClick={handleFinish}
                disabled={isSaving || !members.some((m) => m.name.trim())}
                className="cursor-pointer rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-default disabled:opacity-40"
              >
                {isSaving ? "Setting up..." : "Create household"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              {householdName} is ready
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Taking you to your calendar...
            </p>
          </div>
        )}

        {/* Vision blurb at bottom */}
        {step !== "done" && (
          <p className="mt-8 text-center text-xs leading-relaxed text-slate-400">
            An AI-first household tool that plans, schedules, and proactively<br />
            does things — from grocery runs to flight deals.
          </p>
        )}
      </div>
    </main>
  );
}

function EmojiPicker({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-lg hover:bg-slate-50"
      >
        {selected}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-12 z-20 grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onChange(emoji);
                  setOpen(false);
                }}
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-base hover:bg-slate-100 ${
                  selected === emoji ? "bg-indigo-50 ring-1 ring-indigo-200" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
