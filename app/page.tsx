import { redirect } from "next/navigation";
import { CounterOSDashboard } from "@/components/counteros-dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const dashboardData = getDashboardData(user.id);

  return <CounterOSDashboard initialData={dashboardData} user={user} />;
}
