import { z } from "zod";

const productText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);

export const productProfilePatchSchema = z
  .object({
    name: productText("Name", 160).optional(),
    description: productText("Description", 2000).optional(),
    icp: productText("ICP", 1000).optional(),
    category: productText("Category", 240).optional(),
    geography: productText("Geography", 240).optional(),
    wedge: productText("Wedge", 1000).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one product profile field."
  });

export type ProductProfilePatchInput = z.infer<typeof productProfilePatchSchema>;
