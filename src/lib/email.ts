import "server-only";

/**
 * Pluggable transactional email. When RESEND_API_KEY and EMAIL_FROM are set,
 * verification and reset emails are active and email-verification becomes
 * enforced before the first login. Without them the app degrades gracefully:
 * registration works unverified, recovery reports itself unavailable, and the
 * weekly report cron is a no-op.
 */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const APP_URL = () => (process.env.APP_URL ?? "").replace(/\/$/, "");

export function verificationEmail(token: string, email: string): {
  subject: string;
  text: string;
} {
  return {
    subject: "Confirma o teu email — Gym Tracker",
    text:
      "Confirma o teu email para ativar a conta (válido por 24 horas):\n" +
      `${APP_URL()}/verificar?token=${token}&email=${encodeURIComponent(email)}\n\n` +
      "Se não criaste esta conta, ignora este email.",
  };
}

export function resetEmail(token: string, email: string): {
  subject: string;
  text: string;
} {
  return {
    subject: "Repor palavra-passe — Gym Tracker",
    text:
      "Usa este link para escolheres uma nova palavra-passe (válido por 1 hora):\n" +
      `${APP_URL()}/repor?token=${token}&email=${encodeURIComponent(email)}\n\n` +
      "Se não pediste a reposição, ignora este email.",
  };
}

export function accountDeletedEmail(): { subject: string; text: string } {
  return {
    subject: "Conta eliminada — Gym Tracker",
    text: "A tua conta e todos os dados associados foram eliminados.",
  };
}
