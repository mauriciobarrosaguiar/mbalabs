import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type GithubRelease = {
  tag_name?: string;
  draft?: boolean;
  assets?: Array<{
    name?: string;
    browser_download_url?: string;
  }>;
};

function versionCodeFromName(versionName: string) {
  const match = versionName.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return 0;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  return major * 10_000 + minor * 100 + patch;
}

export async function GET() {
  let versionName = process.env.IGREJA_ANDROID_VERSION_NAME ?? "";
  let versionCode = Number(process.env.IGREJA_ANDROID_VERSION_CODE ?? "0");
  let apkUrl = process.env.IGREJA_ANDROID_APK_URL ?? "";
  const required = process.env.IGREJA_ANDROID_UPDATE_REQUIRED === "true";

  try {
    const response = await fetch(
      "https://api.github.com/repos/mauriciobarrosaguiar/mbalabs/releases?per_page=20",
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "MBA-Labs-Elshaday-App-Updater"
        },
        next: { revalidate: 300 }
      }
    );

    if (response.ok) {
      const releases = (await response.json()) as GithubRelease[];
      const release = releases.find(
        (item) => !item.draft && item.tag_name?.startsWith("elshaday-v")
      );

      if (release?.tag_name) {
        const releaseVersion = release.tag_name.replace(/^elshaday-v/, "");
        const apkAsset = release.assets?.find(
          (asset) => asset.name?.toLowerCase().endsWith(".apk") && asset.browser_download_url
        );

        if (apkAsset?.browser_download_url) {
          versionName = releaseVersion;
          versionCode = versionCodeFromName(releaseVersion);
          apkUrl = apkAsset.browser_download_url;
        }
      }
    }
  } catch {
    // Mantém fallback configurável por ambiente se o GitHub estiver indisponível.
  }

  return NextResponse.json(
    {
      versionCode: Number.isFinite(versionCode) ? versionCode : 0,
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
