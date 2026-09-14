import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const versionCode = Number(process.env.IGREJA_ANDROID_VERSION_CODE ?? "1");
  const versionName = process.env.IGREJA_ANDROID_VERSION_NAME ?? "1.0.0";
  const apkUrl = process.env.IGREJA_ANDROID_APK_URL ?? "";
  const required = process.env.IGREJA_ANDROID_UPDATE_REQUIRED === "true";

  return NextResponse.json(
    {
      versionCode: Number.isFinite(versionCode) ? versionCode : 1,
      versionName,
      apkUrl,
      required
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0"
      }
    }
  );
}
