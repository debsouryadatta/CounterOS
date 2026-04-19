import { redirect } from "next/navigation";
import { CounterOSDashboard } from "@/components/counteros-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createEmptyWorkspaceForUser,
  getDashboardData
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  createEmptyWorkspaceForUser(user.id, user.email, user.name);
  const dashboardData = getDashboardData(user.id);

  return <CounterOSDashboard initialData={dashboardData} user={user} />;
}
