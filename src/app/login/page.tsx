import { redirect } from "next/navigation";
import { auth, authProviders, signIn } from "@/lib/auth";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await auth();
  if (session?.user?.id) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="flex h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border p-8">
        <h1 className="text-center text-xl font-semibold">Research Agent にログイン</h1>
        {error && (
          <p className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            ログインできませんでした。許可されたアカウントか確認してください。
          </p>
        )}
        {authProviders.length === 0 && (
          <p className="text-sm text-muted">
            ログイン方法が設定されていません。.env に AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET を設定するか、
            開発時は AUTH_DEV_LOGIN=true にしてください。
          </p>
        )}
        {authProviders.some((p) => p.id === "google") && (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button className="w-full rounded-lg border border-border px-4 py-2.5 font-medium hover:bg-bubble">
              Google でログイン
            </button>
          </form>
        )}
        {authProviders.some((p) => p.id === "dev") && (
          <form
            className="space-y-2"
            action={async (formData) => {
              "use server";
              await signIn("dev", { email: formData.get("email"), redirectTo: "/" });
            }}
          >
            <p className="text-xs text-muted">開発用ログイン（本番では無効）</p>
            <input
              name="email"
              type="email"
              required
              defaultValue="dev@example.com"
              aria-label="メールアドレス"
              className="w-full rounded-lg border border-border bg-transparent px-3 py-2"
            />
            <button className="w-full rounded-lg bg-foreground px-4 py-2.5 font-medium text-background">
              ログイン
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
