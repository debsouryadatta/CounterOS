import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listSignals } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const signals = listSignals(auth.workspace.id);

  return NextResponse.json({ signals });
}
