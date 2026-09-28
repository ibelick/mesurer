const encodeBase64Url = (bytes: Uint8Array) => {
  let value = ""
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

export const randomBase64Url = (byteLength: number, crypto: Crypto) =>
  encodeBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)))

export const createPkce = async (crypto: Crypto) => {
  const verifier = randomBase64Url(64, crypto)
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return { verifier, challenge: encodeBase64Url(new Uint8Array(digest)) }
}
