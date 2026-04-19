import { getServerSession } from "next-auth";
import { findUserById } from "@/lib/db/queries";
import { authOptions } from "./options";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.email) {
    return null;
  }

  const user = findUserById(session.user.id);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name
  };
}
