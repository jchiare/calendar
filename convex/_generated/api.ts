import { anyApi, type FunctionReference } from "convex/server";

// Generic ID type since we don't have generated dataModel
type Id<T extends string> = string & { __tableName: T };

type Api = {
  events: {
    getWeekEvents: FunctionReference<
      "query",
      "public",
      { weekStart: number },
      Array<{
        _id: Id<"events">;
        _creationTime: number;
        calendarId: Id<"calendars">;
        title: string;
        description?: string;
        start: number;
        end: number;
        location?: string;
        updatedAt: number;
        createdAt: number;
      }>
    >;
    getTodayEvents: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      Array<{
        _id: Id<"events">;
        _creationTime: number;
        calendarId: Id<"calendars">;
        title: string;
        description?: string;
        start: number;
        end: number;
        location?: string;
        updatedAt: number;
        createdAt: number;
      }>
    >;
    createEvent: FunctionReference<
      "mutation",
      "public",
      {
        title: string;
        description?: string;
        start: number;
        end: number;
        location?: string;
      },
      Id<"events">
    >;
    updateEvent: FunctionReference<
      "mutation",
      "public",
      {
        id: Id<"events">;
        title: string;
        description?: string;
        start: number;
        end: number;
        location?: string;
      },
      void
    >;
    deleteEvent: FunctionReference<
      "mutation",
      "public",
      { id: Id<"events"> },
      void
    >;
    seedDemo: FunctionReference<
      "mutation",
      "public",
      Record<string, never>,
      { seeded: boolean }
    >;
  };
  notes: {
    getWelcome: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      { message: string }
    >;
  };
};

export const api: Api = anyApi as unknown as Api;
