import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { getProductProfile, updateProductProfile } from "@/lib/db/queries";
import { productProfilePatchSchema } from "@/lib/validation/product";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const productProfile = getProductProfile(auth.workspace.id);

  if (!productProfile) {
    return NextResponse.json({ error: "Product profile not found." }, { status: 404 });
  }

  return NextResponse.json({ productProfile });
}

export async function PATCH(request: Request) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = productProfilePatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid product profile." },
      { status: 400 }
    );
  }

  const productProfile = updateProductProfile({
    workspaceId: auth.workspace.id,
    updates: parsed.data
  });

  if (!productProfile) {
    return NextResponse.json({ error: "Product profile not found." }, { status: 404 });
  }

  return NextResponse.json({ productProfile });
}
