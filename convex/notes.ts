import { query } from "convex/server";

export const getWelcome = query({
  args: {},
  handler: async () => {
    return {
      message: "Convex is ready for your family calendar."
    };
  }
});
