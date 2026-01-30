import { anyApi, type FunctionReference } from "convex/server";

type Api = {
  notes: {
    getWelcome: FunctionReference<"query", "public", Record<string, never>, { message: string }>;
  };
};

export const api: Api = anyApi as unknown as Api;
