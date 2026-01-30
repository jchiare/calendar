# Calendar Web App Plan (Next.js 16 + Tailwind + Convex)

## Goals
- Build a modern calendar web app with deep integrations and an AI chat assistant.
- Prioritize fast scheduling, cross-service syncing, and rich automations.
- Ensure strong privacy, multi-tenant security, and scalable realtime updates.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui (optional).
- **Backend**: Convex (realtime DB, functions, auth).
- **Auth**: Convex Auth + OAuth (Google, Microsoft).
- **Integrations**: Google Calendar (primary), Microsoft Graph, Zoom/Meet, Slack, Notion, Jira, Linear, Asana. Apple Calendar (CalDAV) deferred.
- **AI**: OpenAI/Anthropic via secure server-side proxy, tool calling for calendar actions.
- **Notifications**: Email (Postmark), push (Web Push), in-app.
- **Observability**: Sentry, PostHog.

## Core Product Scope
1. **Calendar Views**
   - Day/Week/Month/Agenda views with quick navigation.
   - Drag-and-drop events, recurring rules, time zone support.
2. **Event Management**
   - Create, edit, RSVP, multi-attendee scheduling, availability checking.
   - Conferencing links and location handling.
3. **Integrations Hub**
   - OAuth connections with sync status and conflict handling.
   - Sync policies: bidirectional, read-only, or manual import.
4. **AI Assistant**
   - Chat-driven scheduling and summaries ("Schedule a 30-min sync next week").
   - Context: user preferences, working hours, existing events.
   - Confirmation policy: always confirm destructive actions, allow user preference for routine adds/edits.
5. **Automations**
   - Rules: “If external event has ‘1:1’, add 10-min buffer.”
   - Templates for meeting types and agendas.

## Information Architecture
- **Workspace**: multi-tenant container for users, calendars, integrations.
- **Calendars**: internal calendars + external connected calendars.
- **Events**: core event model with attendees, recurrence, metadata.
- **Threads**: AI chat sessions with tool call history.
- **Automation Rules**: triggers + actions with audit logs.

## Key Convex Data Models (Draft)
- `users`: name, email (unique), timezone, preferences, createdAt. Index: `by_email`.
- `workspaces`: name, ownerId, plan, createdAt. Index: `by_owner`.
- `memberships`: userId, workspaceId, role, createdAt. Indexes: `by_user`, `by_workspace`.
- `calendars`: workspaceId, provider, externalId, syncStatus, timezone. Indexes: `by_workspace`, `by_provider_external`.
- `events`: calendarId, title, start/end, attendees, recurrence, metadata, updatedAt. Index: `by_calendar`.
- `integrations`: workspaceId, provider, tokens, scopes, lastSyncedAt, status. Indexes: `by_workspace`, `by_provider`.
- `aiThreads`: userId, workspaceId, messages, toolCalls, createdAt. Index: `by_workspace`.
- `automationRules`: workspaceId, trigger, action, enabled, createdAt. Index: `by_workspace`.

## API + Sync Strategy
- **Inbound**: webhook endpoints for provider event updates.
- **Outbound**: webhook + sync queue pattern with backoff, retries, and periodic reconciliation.
- **Conflict resolution**: detect conflicting updates and surface UI choices (keep local, keep remote, merge).
- **Rate limiting**: per-provider quotas, adaptive scheduling.

## UI/UX Plan
- Global nav: Calendar, Integrations, Automations, AI Assistant, Settings.
- Calendar grid with resizable events and inline edit forms.
- AI chat panel docked on right or modal.
- Integration marketplace cards with quick connect.
- Conflict resolution banner with action buttons (keep local, keep remote, merge).

## Security & Compliance
- Encrypted secrets (Convex secrets/edge storage).
- Role-based access controls (workspace, calendar, event).
- Audit trail for sync and AI-driven actions.

## Milestones
1. **MVP (8 weeks)**
   - Convex Auth + workspace
   - Calendar CRUD
   - Google Calendar sync (webhooks + queue)
   - Conflict resolution UI
2. **v1 (12–16 weeks)**
   - AI chat for event creation and summaries
   - Advanced availability & scheduling
   - Automations and templates
3. **Growth**
   - Team analytics, collaboration, admin console
   - More integrations and enterprise features

## Open Questions
- Preferred provider priority for integrations: Google Calendar first, note Apple Calendar (CalDAV) as a later-phase integration.
- AI scope: write access by default, with user preference for confirmation threshold.
- Expected scale: family (single team with multiple users).
