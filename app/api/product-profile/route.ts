import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import {
  createProductProfile,
  getProductProfile,
  updateProductProfile
} from "@/lib/db/queries";
import type { ProductProfile } from "@/lib/types";
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

  const existingProfile = getProductProfile(auth.workspace.id);

  if (!existingProfile) {
    if (!isCompleteProductProfile(parsed.data)) {
      return NextResponse.json(
        { error: "Create the first product profile with all profile fields." },
        { status: 400 }
      );
    }

    const productProfile = createProductProfile({
      workspaceId: auth.workspace.id,
      profile: parsed.data
    });

    return NextResponse.json({ productProfile });
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

function isCompleteProductProfile(
  value: Partial<ProductProfile>
): value is ProductProfile {
  return Boolean(
    value.name &&
      value.description &&
      value.icp &&
      value.category &&
      value.geography &&
      value.wedge
  );
}
