import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getTrackedPage } from "@/lib/db/queries";
import { snapshotTrackedPage } from "@/lib/pages/snapshot";
import { trackedPageIdParamsSchema } from "@/lib/validation/pages";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<unknown> }
) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const params = await context.params;
  const parsedParams = trackedPageIdParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid tracked page id." }, { status: 400 });
  }

  const trackedPage = getTrackedPage(auth.workspace.id, parsedParams.data.id);

  if (!trackedPage) {
    return NextResponse.json({ error: "Tracked page not found." }, { status: 404 });
  }

  try {
    const { snapshot, signal } = await snapshotTrackedPage({
      workspaceId: auth.workspace.id,
      trackedPageId: trackedPage.id
    });

    return NextResponse.json({ snapshot, signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown page fetch error";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
