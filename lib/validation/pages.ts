import { z } from "zod";

export const trackedPageIdParamsSchema = z.object({
  id: z.string().uuid("Invalid tracked page id.")
});

export const pageTypeSchema = z.enum([
  "homepage",
  "pricing",
  "changelog",
  "blog",
  "docs",
  "careers",
  "other"
]);

export const createTrackedPageSchema = z
  .object({
    competitorId: z.string().uuid().nullable().optional(),
    url: z.string().trim().url("Enter a valid page URL."),
    pageType: pageTypeSchema.default("other")
  })
  .strict();
