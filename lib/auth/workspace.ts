import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDefaultWorkspace } from "@/lib/db/queries";
import type { Workspace } from "@/lib/db/schema";
import type { CurrentUser } from "@/lib/types";

type WorkspaceAuthResult =
  | {
      ok: true;
      user: CurrentUser;
      workspace: Workspace;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireWorkspace(): Promise<WorkspaceAuthResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const workspace = getDefaultWorkspace(user.id);

  if (!workspace) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    };
  }

  return {
    ok: true,
    user,
    workspace
  };
}
