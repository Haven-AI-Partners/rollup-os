/**
 * Email domains allowed to access the application.
 * Users with emails outside these domains will be blocked after sign-in.
 */
export const ALLOWED_DOMAINS = [
  "wayequity.co",
  "rengapartners.com",
  "havenaipartners.com",
];

export function isAllowedEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}
