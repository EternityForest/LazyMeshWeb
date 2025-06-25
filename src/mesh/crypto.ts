export async function deriveRoutingKey(psk: Uint8Array, unixTime: number): Promise<Uint8Array> {
  const hoursSinceEpoch = Math.floor(unixTime / 3600);
  const encoder = new TextEncoder();
  const r = encoder.encode("r");
  const hourBytes = new Uint8Array(new Uint32Array([hoursSinceEpoch]).buffer);

  const hashInput1 = new Uint8Array([...r, ...hourBytes, ...psk]);
  const hash1 = await crypto.subtle.digest("SHA-256", hashInput1);


  const part1 = new Uint8Array(hash1).slice(0, 16);
  return new Uint8Array(part1);
}

export async function deriveCryptoKey(psk: Uint8Array,unixTime: number): Promise<Uint8Array> {
  const hoursSinceEpoch = Math.floor(unixTime / 3600);
  const encoder = new TextEncoder();
  const r = encoder.encode("c");
  const hourBytes = new Uint8Array(new Uint32Array([hoursSinceEpoch]).buffer);

  const hashInput1 = new Uint8Array([...r, ...hourBytes, ...psk]);
  const hash1 = await crypto.subtle.digest("SHA-256", hashInput1);
  return new Uint8Array(hash1).slice(0, 16);
}


export async function aesGcmEncrypt(plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<{ ciphertext: Uint8Array, tag: Uint8Array }> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 96 }, cryptoKey, plaintext);

  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertext = encryptedBytes.slice(0, -12);
  const tag = encryptedBytes.slice(-12, -6); // your spec uses 6-byte tag
  return { ciphertext, tag };
}

export async function aesGcmDecrypt(ciphertext: Uint8Array, tag: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 96 }, cryptoKey, new Uint8Array([...ciphertext, ...tag]));
  return new Uint8Array(decrypted);
}