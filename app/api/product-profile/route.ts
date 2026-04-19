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
    if (!parsed.data.description?.trim()) {
      return NextResponse.json(
        { error: "Add a short description of what you are building first." },
        { status: 400 }
      );
    }

    const productProfile = createProductProfile({
      workspaceId: auth.workspace.id,
      profile: completeProductProfile(parsed.data, auth.workspace.name)
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

function completeProductProfile(
  value: Partial<ProductProfile>,
  fallbackName: string
): ProductProfile {
  return {
    name: value.name?.trim() || fallbackName || "My company",
    description: value.description?.trim() || "Not specified yet.",
    icp: value.icp?.trim() || "Not specified yet.",
    category: value.category?.trim() || "Not specified yet.",
    geography: value.geography?.trim() || "Not specified yet.",
    wedge: value.wedge?.trim() || "Not specified yet."
  };
}
