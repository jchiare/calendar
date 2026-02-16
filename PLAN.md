# Calendar Web App Plan (AI-Assisted, Chat-Driven)

## Vision
An AI-first household operating tool that plans, schedules, and proactively helps before problems happen. The calendar remains the command center, but the assistant uses household context to act early: warn when food is running low, flag when traffic puts someone at risk of being late, and surface opportunities like cheaper flights during newly free time.

## Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Logo    Calendar    Settings                                    │
├────────────────────────────────────────────┬─────────────────────┤
│                                            │  AI Chat            │
│          Full Calendar View                │                     │
│          (week view, big & rich)           │  ┌───────────────┐  │
│                                            │  │ coffee with    │  │
│  ┌──────┬──────┬──────┬──────┬──────┐      │  │ george tmrw 3  │  │
│  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │      │  └───────────────┘  │
│  │      │      │      │      │      │      │                     │
│  │      │ 2:00 │      │      │      │      │  Coffee w/ George   │
│  │      │ Yoga │      │      │      │      │  Tue 3:00-3:30pm    │
│  │      │      │      │      │      │      │  30 min · no loc    │
│  │      │ .... │      │      │      │      │                     │
│  │      │ 3:00 │      │      │      │      │  [Add]  [Tweak]     │
│  │      │Coffee│      │      │      │      │                     │
│  │      │ ghost│      │      │      │      │  ─────────────────  │
│  │      │      │      │      │      │      │  Suggestions:       │
│  │      │      │      │      │      │      │  "What's tomorrow?" │
│  │      │      │      │      │      │      │  "Clear Friday PM"  │
│  └──────┴──────┴──────┴──────┴──────┘      │                     │
│                                            │  ┌───────────────┐  │
│  < Prev    Today    Next >                 │  │ Type here...  │  │
│                                            │  └───────────────┘  │
└────────────────────────────────────────────┴─────────────────────┘
```

- **Left ~70%**: Full weekly calendar grid (existing drag/drop/resize stays)
- **Right ~30%**: Compact AI chat panel (always visible, no toggle needed)
- Calendar still supports manual click-to-create as a fallback

## Household Multi-Person Model

- A `workspace` represents one household.
- Each person in the home gets a member profile with role-based permissions (`owner`, `adult`, `caregiver`, `child-view`, `guest`).
- Each event should track `ownerUserId` and participant member IDs so AI can reason about "who is affected."
- Household view combines:
  - Shared calendar (family logistics, bills, appointments, travel)
  - Personal calendars (school/work/extracurricular)
- AI should always explain who an action affects before confirming edits to shared events.

## Household Onboarding Flow

1. Create household workspace and pick home timezone.
2. Add members (name, relationship, role, optional age group).
3. Connect each member's calendar(s) or start with local Convex calendars.
4. Set household defaults:
   - working/school hours
   - quiet hours
   - driving and prep-time buffers
5. Configure AI guardrails:
   - auto-add vs confirm-first
   - which members AI can edit directly
   - notification preferences per member
6. Run a first-week setup pass:
   - import recurring routines
   - detect conflicts
   - suggest fixes for approval

## Proactive Assistant Scope

- **Home inventory**: detect low-fridge pantry staples and suggest reorder windows around existing errands.
- **Travel-time risk**: detect higher-than-usual traffic and warn early with leave-now recommendations.
- **Opportunity detection**: identify unexpected free windows and alert on timely opportunities (for example, cheaper flight windows).

## Core UX Flow

1. User types something like `coffee with george tomorrow 3` in the chat input
2. AI parses and **infers everything**:
   - Title: "Coffee with George"
   - When: Tomorrow 3:00 PM
   - Duration: 30 min (it's coffee, not a meeting)
   - Who: George (recognized from context/contacts)
   - Location: none specified, leave blank
3. A **compact confirmation card** appears inline in the chat:
   ```
   Coffee with George
   Tue 3:00-3:30pm · 30 min
   [Add]  [Tweak]
   ```
4. Simultaneously, a **ghost event** appears on the calendar in the right slot (pulsing/translucent)
5. User taps **Add** → event is saved, ghost becomes solid, done
6. Or taps **Tweak** → card expands with editable fields inline (not a modal)

## AI Smart Inference

The AI should feel like a smart assistant who just *gets it*. Key inference rules:

### Duration by event type
| Input | Inferred duration |
|-------|-------------------|
| coffee, lunch, drinks | 30 min |
| meeting, sync, standup | 30 min |
| dinner, movie | 1.5 hr |
| workout, gym, run | 1 hr |
| dentist, doctor, appointment | 1 hr |
| flight, travel | user must specify |
| "quick chat", "quick call" | 15 min |
| 1:1, one-on-one | 30 min |
| workshop, training | 2 hr |
| Default (unrecognized) | 1 hr |

### Other smart inferences
- **People**: "with George" → attendee George
- **Location**: "at Blue Bottle" → location = "Blue Bottle"
- **Recurrence**: "every Monday" → weekly recurring
- **Time of day**: "morning" → 9am, "afternoon" → 2pm, "evening" → 6pm
- **Relative dates**: "tomorrow", "next Tuesday", "this weekend"
- **Conflicts**: If the slot is taken, AI proactively says "You have Yoga at 3. Want 3:30 instead?"

## Confirmation UX (Non-Annoying)

The confirmation is an **inline chat card**, not a modal or separate screen. Design principles:

1. **One line summary** — title, time, duration. That's it.
2. **Two buttons** — `Add` (primary, green) and `Tweak` (secondary, subtle)
3. **No friction for obvious events** — don't ask "are you sure?" for simple adds
4. **Tweak expands inline** — shows editable title, date, time, duration, location, notes. Still in the chat flow, not a popup.
5. **Ghost event on calendar** — the visual preview IS the confirmation. You see it on your calendar before saving.
6. **Auto-dismiss after Add** — card collapses to a one-line "Added" message
7. **Undo** — small "undo" link on the confirmation message for 10 seconds

### What Tweak looks like (expanded):
```
Coffee with George
┌────────────────────────────┐
│ Title:    [Coffee w/ George  ] │
│ Date:     [Tue, Feb 17       ] │
│ Time:     [3:00 PM           ] │
│ Duration: [30 min        v   ] │
│ Location: [                  ] │
│ Notes:    [                  ] │
│                                │
│ [Save]  [Cancel]               │
└────────────────────────────┘
```

## Chat Panel Features

- **Suggested prompts** at the bottom when idle (contextual):
  - "What's my week look like?"
  - "Move yoga to Thursday"
  - "Cancel tomorrow's standup"
- **Multi-turn context** — "Actually make it 4pm" works as a follow-up
- **Beyond create** — the chat also handles:
  - "What do I have tomorrow?" → shows summary
  - "Move the dentist to Friday" → proposes change with ghost preview
  - "Delete the 3pm meeting" → confirms with a small card
  - "Am I free Thursday afternoon?" → checks availability

## Tech Stack
- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend**: Convex (realtime DB, functions, auth)
- **AI**: OpenAI Responses API with structured tool calling
- **Auth**: Convex Auth + OAuth (Google)

## AI Backend Architecture

### Tool-calling approach
The AI uses OpenAI Responses with structured tool calls:
- `create_event({ title, start, end, location?, attendees?, notes? })` → returns draft for confirmation
- `update_event({ id, changes })` → returns diff for confirmation
- `delete_event({ id })` → returns event details for confirmation
- `query_events({ date_range, filters? })` → returns matching events
- `check_availability({ date_range })` → returns free/busy slots

### Draft flow
1. User message → OpenAI Responses API with tools + system prompt (smart inference rules)
2. OpenAI calls tool → returns structured event proposal (not saved yet)
3. Frontend renders confirmation card + ghost event
4. User confirms → Convex mutation saves the event
5. Real-time subscription updates calendar

## Convex Data Models

```
users:       name, email, timezone, preferences
workspaces:  name, ownerId, plan
memberships: userId, workspaceId, role
calendars:   workspaceId, provider, externalId, syncStatus
events:      calendarId, title, start, end, location, attendees, recurrence, metadata
aiThreads:   userId, workspaceId, messages[], createdAt
integrations: workspaceId, provider, tokens, scopes, lastSyncedAt
```

No separate `eventDrafts` table — drafts live in client state until confirmed.

## Implementation Plan

### Phase 0: Household Foundation
1. Add household setup flow (create workspace, invite members, assign roles)
2. Introduce event ownership + participant linkage for member-aware AI actions
3. Scope all event queries by active workspace to avoid cross-household mixing
4. Add permission checks for shared-event edits and deletions

### Phase 1: AI Chat Panel + Smart Create
1. Add chat panel to the right side of calendar page (split layout)
2. Integrate OpenAI Responses API via Convex action (server-side)
3. Implement smart inference (duration by type, attendees, location parsing)
4. Build inline confirmation card component
5. Add ghost/preview event rendering on calendar
6. Wire up confirm → save flow
7. Support multi-turn conversation context

### Phase 2: Full Chat Capabilities
- Edit events via chat ("move X to Y")
- Delete events via chat with confirmation
- Query events ("what's tomorrow?", "am I free Friday?")
- Conflict detection and alternative suggestions

### Phase 3: Polish + Integrations
- Google Calendar OAuth + sync
- Recurring event support via chat
- User preferences (working hours, default duration overrides)
- Mobile responsive layout

## Open Questions
- Should the chat panel be collapsible on mobile (slide-out drawer)?
- Add keyboard shortcut to focus the chat input (Cmd+K)?
- Should ghost events show on the calendar immediately while AI is "thinking", or only after response?
