import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { allowedDomains, allowedEmails, env } from "@/env";
import { upsertUser } from "@/lib/db/queries";

const devLoginEnabled = env.AUTH_DEV_LOGIN && process.env.NODE_ENV !== "production";

const providers: Provider[] = [];
if (env.AUTH_GOOGLE_ID) providers.push(Google);
if (devLoginEnabled) {
  // ローカル開発用: メールアドレスだけでログインできる。本番では無効
  providers.push(
    Credentials({
      id: "dev",
      name: "開発用ログイン",
      credentials: { email: { label: "Email", type: "email" } },
      authorize: async (c) => {
        const email = String(c?.email ?? "").trim();
        return email ? { email, name: email.split("@")[0] } : null;
      },
    }),
  );
}

export function isEmailAllowed(email: string) {
  const e = email.toLowerCase();
  if (allowedEmails.length === 0 && allowedDomains.length === 0) return true;
  return allowedEmails.includes(e) || allowedDomains.includes(e.split("@")[1] ?? "");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    signIn: ({ user, profile }) => {
      const email = user.email ?? profile?.email;
      if (!email) return false;
      // Google の場合はメール確認済みであることも求める
      if (profile && profile.email_verified === false) return false;
      return isEmailAllowed(email);
    },
    jwt: async ({ token, user, trigger }) => {
      if ((trigger === "signIn" || !token.uid) && token.email) {
        const row = await upsertUser({
          email: token.email,
          name: user?.name ?? token.name,
          image: user?.image ?? token.picture,
        });
        token.uid = row.id;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});

// プロバイダー関数は既定値を返し、上書き分は options に入っているので両方を見る
export const authProviders = providers.map((p) => {
  const c = typeof p === "function" ? p() : p;
  const o = (c as { options?: { id?: string; name?: string } }).options;
  return { id: o?.id ?? c.id, name: o?.name ?? c.name };
});

/** ログイン中のユーザー ID。未ログインなら null */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
