import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/workspace";
import { discoverCompanies, normalizeDomain } from "@/lib/crustdata/intelligence";
import { createSuggestedCompetitor } from "@/lib/db/queries";

export const runtime = "nodejs";

const discoverySchema = z
  .object({
    query: z.string().trim().min(2).max(500),
    limit: z.number().int().min(1).max(20).default(8)
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = discoverySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a discovery query." }, { status: 400 });
  }

  if (!process.env.CRUSTDATA_API_KEY) {
    return NextResponse.json({ error: "CRUSTDATA_API_KEY is not configured." }, { status: 503 });
  }

  const companies = await discoverCompanies({
    query: parsed.data.query,
    limit: parsed.data.limit,
    workspaceId: auth.workspace.id
  });

  const suggestions = companies
    .map((company) => {
      const domain =
        company.basic_info?.primary_domain ?? normalizeDomain(company.basic_info?.website);

      if (!domain) {
        return null;
      }

      return createSuggestedCompetitor({
        workspaceId: auth.workspace.id,
        name: company.basic_info?.name ?? domain,
        domain,
        description: "Discovered by Crustdata Company Search.",
        threatType: "Emerging",
        confidence: 70,
        priority: "Medium",
        evidence: [
          "Returned by Crustdata Company Search for the founder's discovery query.",
          company.basic_info?.employee_count_range
            ? `Employee range: ${company.basic_info.employee_count_range}.`
            : "Company profile returned without employee range."
        ],
        intelligenceStatus: "resolved",
        crustdataCompanyId: company.crustdata_company_id ?? null,
        identifiedAt: new Date().toISOString()
      });
    })
    .filter(Boolean);

  return NextResponse.json({ suggestions });
}
