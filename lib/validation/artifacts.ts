import { z } from "zod";

export const artifactIdParamsSchema = z.object({
  id: z.string().uuid("Invalid artifact id.")
});
