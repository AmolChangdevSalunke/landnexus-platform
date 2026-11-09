/**
 * Saves a blob through a temporary object URL and a temporary anchor.
 * Uploaded files are never embedded in an iframe or opened inline.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/**
 * Reads the filename from a Content-Disposition header, preferring the
 * RFC 5987 encoded form. Falls back to the supplied name.
 */
export function filenameFromContentDisposition(
  disposition: string | undefined,
  fallback: string,
): string {
  if (!disposition) {
    return fallback
  }

  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim())
    } catch {
      return fallback
    }
  }

  const quoted = /filename="?([^";]+)"?/i.exec(disposition)
  return quoted?.[1]?.trim() || fallback
}
