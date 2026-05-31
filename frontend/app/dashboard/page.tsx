import { redirect } from "next/navigation";
import { getProfileAction } from "@/lib/actions";
import { UserProfile } from "@/lib/auth";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function DashboardPage() {
  const result = await getProfileAction();

  if (!result.ok || !result.data) {
    redirect("/api/logout");
  }

  return <DashboardShell user={result.data as UserProfile} />;
}
