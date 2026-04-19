import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/workspace";
import { CrustdataError } from "@/lib/crustdata/client";
import { generateHiringSignalsForWorkspace } from "@/lib/signals/hiring";

export const runtime = "nodejs";

const generateSignalsSchema = z
  .object({
    competitorId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(50).default(25)
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const parsed = generateSignalsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid signal generation request." },
      { status: 400 }
    );
  }

  if (!process.env.CRUSTDATA_API_KEY) {
    return NextResponse.json({ error: "CRUSTDATA_API_KEY is not configured." }, { status: 503 });
  }

  try {
    const result = await generateHiringSignalsForWorkspace({
      workspaceId: auth.workspace.id,
      competitorId: parsed.data.competitorId,
      limit: parsed.data.limit
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CrustdataError) {
      return NextResponse.json(
        {
          error: error.message,
          provider: "crustdata",
          endpoint: error.endpoint,
          status: error.status,
          responseBody: error.responseBody
        },
        { status: 502 }
      );
    }

    throw error;
  }
}
