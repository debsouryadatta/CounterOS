import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createDefaultWorkspaceForUser } from "@/lib/db/seed-workspace";
import { createUser, findUserByEmail } from "@/lib/db/queries";

export const runtime = "nodejs";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(80).optional()
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Use a valid email and a password with at least 8 characters." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = findUserByEmail(email);

  if (existingUser) {
    return NextResponse.json(
      { error: "An account already exists for this email." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const user = createUser({
    email,
    name: parsed.data.name,
    passwordHash
  });

  createDefaultWorkspaceForUser(user.id, user.email, user.name);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name
    }
  });
}
