import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/workspace";
import { appendChatTurn } from "@/lib/db/queries";

export const runtime = "nodejs";

const messageSchema = z.object({
  text: z.string().trim().min(1).max(2000)
});

export async function POST(request: Request) {
  const auth = await requireWorkspace();

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = messageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a message first." }, { status: 400 });
  }

  const messages = appendChatTurn({
    workspaceId: auth.workspace.id,
    userText: parsed.data.text
  });

  return NextResponse.json({ messages });
}
