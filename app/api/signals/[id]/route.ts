import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getSignal } from "@/lib/db/queries";
import { signalIdParamsSchema } from "@/lib/validation/signals";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const params = await context.params;
  const parsedParams = signalIdParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid signal id." }, { status: 400 });
  }

  const signal = getSignal(auth.workspace.id, parsedParams.data.id);

  if (!signal) {
    return NextResponse.json({ error: "Signal not found." }, { status: 404 });
  }

  return NextResponse.json({ signal });
}
