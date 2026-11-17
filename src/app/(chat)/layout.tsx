import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function ChatLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="flex h-dvh">
      <Sidebar userId={session.user.id} userName={session.user.name ?? session.user.email ?? ""} />
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
