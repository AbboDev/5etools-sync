const CLIENT_ID =
  import.meta.env.BROWSER === 'firefox'
    ? import.meta.env.WXT_FIREFOX_CLIENT_ID
    : import.meta.env.WXT_CHROME_CLIENT_ID;

const SCOPES = "https://www.googleapis.com/auth/drive.file";
const REDIRECT_URI = browser.identity.getRedirectURL();

export async function getAuthToken() {
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${CLIENT_ID}` +
    `&response_type=token` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}`;

  const responseUrl = await browser.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  });

  if (!responseUrl) {
    throw new Error("Failed to launch web auth flow");
  }

  const match = new URL(responseUrl).hash.match(/access_token=([^&]+)/);
  if (!match || !match[1]) {
    throw new Error("Failed to extract access token from response");
  }

  const token = match[1];

  return token;
}

export async function findFile(token: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='5etools-sync.json'`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();

  return data.files?.[0];
}

export async function uploadFile(token: string, content: string, fileId: string | null = null) {
  const metadata = {
    name: "5etools-sync.json",
    mimeType: "application/json"
  };

  const boundary = "-------314159265358979323846";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    content +
    `\r\n--${boundary}--`;

  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const response = await fetch(url, {
    method: fileId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body
  });

  return await response.json();
}

export async function downloadFile(token: string, fileId: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  return await res.text();
}
