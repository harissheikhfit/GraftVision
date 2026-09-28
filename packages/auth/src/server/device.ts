import "server-only";

import { createHash } from "crypto";

import { headers } from "next/headers";

export async function getDeviceContext(): Promise<{ deviceLabel: string; userAgentHash: string }> {
  const headersList = await headers();
  const ua = headersList.get("user-agent") || "Unknown Device";

  let label = "Unknown Browser";
  if (ua.includes("Edg/")) label = "Edge";
  else if (ua.includes("Chrome/")) label = "Chrome";
  else if (ua.includes("Safari/")) label = "Safari";
  else if (ua.includes("Firefox/")) label = "Firefox";

  let os = "Unknown OS";
  if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Android")) os = "Android";

  const deviceLabel = `${os} / ${label}`;
  const userAgentHash = createHash("sha256").update(ua).digest("hex");

  return { deviceLabel, userAgentHash };
}
