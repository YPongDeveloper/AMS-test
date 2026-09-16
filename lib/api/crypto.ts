// Payload obfuscation and secure envelope for hiding API data in browser DevTools
//
// IMPORTANT: This is devtool obfuscation (XOR + base64), NOT real security.
// The secret is bundled in client JS either way — anyone with DevTools can
// read it. For real API protection, use HTTPS + server-side auth.
//
// Set NEXT_PUBLIC_GATEWAY_SECRET in Vercel env to enable obfuscation.
// If not set, payload will be base64-only (still works, just not hidden).

const GATEWAY_SECRET = process.env.NEXT_PUBLIC_GATEWAY_SECRET || "";

// Encrypt / Mask payload into an opaque token
export function encryptPayload(data: unknown): string {
  try {
    const json = JSON.stringify(data);
    const key = GATEWAY_SECRET;
    const bytes = new TextEncoder().encode(json);
    const keyBytes = new TextEncoder().encode(key);
    const cipher = new Uint8Array(bytes.length);

    for (let i = 0; i < bytes.length; i++) {
      cipher[i] = bytes[i] ^ keyBytes[i % keyBytes.length] ^ ((i * 31) & 0xff);
    }

    // Convert to base64
    let binary = "";
    for (let i = 0; i < cipher.length; i++) {
      binary += String.fromCharCode(cipher[i]);
    }
    const b64 = btoa(binary);
    // Add random checksum padding prefix
    const nonce = Math.random().toString(36).substring(2, 6);
    return `${nonce}.${b64}`;
  } catch {
    // Fallback in case of environment issue
    return btoa(JSON.stringify(data));
  }
}

// Decrypt / Unmask payload from opaque token
export function decryptPayload<T>(token: string): T {
  try {
    let b64 = token;
    if (token.includes(".")) {
      b64 = token.split(".")[1];
    }
    const binary = atob(b64);
    const cipher = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      cipher[i] = binary.charCodeAt(i);
    }

    const key = GATEWAY_SECRET;
    const keyBytes = new TextEncoder().encode(key);
    const bytes = new Uint8Array(cipher.length);
    for (let i = 0; i < cipher.length; i++) {
      bytes[i] = cipher[i] ^ keyBytes[i % keyBytes.length] ^ ((i * 31) & 0xff);
    }

    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  } catch {
    try {
      return JSON.parse(atob(token)) as T;
    } catch {
      return token as unknown as T;
    }
  }
}
