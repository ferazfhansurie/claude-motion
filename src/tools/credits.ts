import { apiCall, type ClientConfig } from "../lib/client.js";

export const creditsSchema = {} as const;

interface MeResponse {
  user?: {
    id: string;
    name: string;
    email: string;
    credits: number;
    role: string;
  };
  subscription?: {
    active?: boolean;
    expiresAt?: string;
  };
}

export async function creditsTool(config: ClientConfig) {
  const res = await apiCall<MeResponse>(config, "/api/auth/me");

  if (!res.ok || !res.data?.user) {
    return errorResult(res.error || "Could not fetch credits.");
  }

  const user = res.data.user;
  const credits = user.credits ?? 0;
  const credits_rm = (credits / 100).toFixed(2);
  const sub = res.data.subscription;

  const subLine = sub?.active
    ? `subscription active${sub.expiresAt ? ` until ${new Date(sub.expiresAt).toLocaleDateString()}` : ""}`
    : "no active subscription";

  return {
    content: [
      {
        type: "text" as const,
        text: [
          `account: ${user.name} <${user.email}>`,
          `credits: ${credits} (≈ RM ${credits_rm})`,
          subLine,
        ].join("\n"),
      },
    ],
  };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}
