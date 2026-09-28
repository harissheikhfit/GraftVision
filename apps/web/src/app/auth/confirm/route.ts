import { type NextRequest, NextResponse } from "next/server";

import { createRequestAuthClient, type EmailOtpType } from "@graftvision/auth/server";

const VALID_OTP_TYPES: EmailOtpType[] = ["invite", "recovery"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const redirectTo = request.nextUrl.clone();
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next"); // We don't use 'next' parameter

  if (token_hash && type && VALID_OTP_TYPES.includes(type)) {
    const client = await createRequestAuthClient();
    const { error } = await client.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      redirectTo.pathname = "/update-password";
      return NextResponse.redirect(redirectTo);
    }
  }

  // return the user to an error page with some instructions
  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "invalid_link");
  return NextResponse.redirect(redirectTo);
}
