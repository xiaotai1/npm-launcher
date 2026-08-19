const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]'])
const URL_PATTERN = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/[^\s"'<>)]*)?/gi

export function normalizeLocalUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === '0.0.0.0' || parsed.hostname === '[::1]') {
      parsed.hostname = 'localhost'
    }
    return parsed.toString().replace(/\/$/, parsed.pathname === '/' ? '' : '/')
  } catch {
    return url
  }
}

export function findLocalUrls(text: string): string[] {
  const urls = new Set<string>()
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0]
    try {
      const parsed = new URL(url)
      if (LOCAL_HOSTS.has(parsed.hostname)) {
        urls.add(normalizeLocalUrl(url))
      }
    } catch {
      // 忽略不完整地址
    }
  }
  return Array.from(urls)
}
