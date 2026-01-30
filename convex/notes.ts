import { queryGeneric } from "convex/server";

export const getWelcome = queryGeneric({
  args: {},
  handler: async () => {
    return {
      message: "Convex is ready for your family calendar."
    };
  }
});
