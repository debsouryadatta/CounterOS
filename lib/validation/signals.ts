import { z } from "zod";

export const signalIdParamsSchema = z.object({
  id: z.string().uuid("Invalid signal id.")
});
