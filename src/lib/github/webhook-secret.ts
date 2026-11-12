// Settings and the rotate endpoint show only the end of a team's webhook
// secret, so the lead can tell secrets apart without anyone else seeing one
// (decision 005, #115).
export function toWebhookSecretLast4({
  webhookSecret,
}: {
  webhookSecret: string;
}): string {
  return webhookSecret.slice(-4);
}
