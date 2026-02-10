export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "";
export const LINE_ADD_FRIEND_URL = "https://line.me/R/ti/p/%40013dgraz";
export const IS_LIFF_ENABLED = LIFF_ID.length > 0;

export const PUBLIC_ROUTES = ["/"];
export const SHARE_ROUTE_PATTERN = /^\/[^/]+\/share\//;

export interface LiffUserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export const LIFF_PROFILE_KEY = "career-ai-liff-profile";

export function isGatedRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return false;
  if (SHARE_ROUTE_PATTERN.test(pathname)) return false;
  return true;
}
