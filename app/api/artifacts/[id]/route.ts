import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getArtifact } from "@/lib/db/queries";
import { artifactIdParamsSchema } from "@/lib/validation/artifacts";

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
  const parsedParams = artifactIdParamsSchema.safeParse(params);

  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid artifact id." }, { status: 400 });
  }

  const artifact = getArtifact(auth.workspace.id, parsedParams.data.id);

  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found." }, { status: 404 });
  }

  return NextResponse.json({ artifact });
}
