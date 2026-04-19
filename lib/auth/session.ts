import { getServerSession } from "next-auth";
import { authOptions } from "./options";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.email) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null
  };
}
