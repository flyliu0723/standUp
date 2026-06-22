import type { AppCategory } from '../types/session'

const BROWSER_PROCESSES = new Set([
  'chrome.exe',
  'msedge.exe',
  'firefox.exe',
  'brave.exe',
  'opera.exe',
  'vivaldi.exe'
])

const LOCAL_DEV_PATTERN =
  /(?:^|[\s(])(localhost|127\.0\.0\.1|0\.0\.0\.0|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?/i

const SITE_RULES: Array<{
  key: string
  label: string
  category: AppCategory
  patterns: RegExp[]
}> = [
  { key: 'localhost', label: '本地开发', category: 'work', patterns: [LOCAL_DEV_PATTERN, /\blocalhost\b/i] },
  { key: 'github', label: 'GitHub', category: 'work', patterns: [/github\.com/i, /\bgithub\b/i] },
  { key: 'gitlab', label: 'GitLab', category: 'work', patterns: [/gitlab/i] },
  { key: 'gitee', label: 'Gitee', category: 'work', patterns: [/gitee\.com/i] },
  { key: 'stackoverflow', label: 'Stack Overflow', category: 'work', patterns: [/stackoverflow/i] },
  { key: 'mdn', label: 'MDN', category: 'work', patterns: [/developer\.mozilla\.org/i, /\bmdn\b/i] },
  { key: 'npm', label: 'npm', category: 'work', patterns: [/npmjs\.com/i] },
  { key: 'jira', label: 'Jira', category: 'work', patterns: [/atlassian\.net/i, /\bjira\b/i] },
  { key: 'notion', label: 'Notion', category: 'work', patterns: [/notion\.so/i, /\bnotion\b/i] },
  { key: 'figma', label: 'Figma', category: 'work', patterns: [/figma\.com/i] },
  { key: 'vercel', label: 'Vercel', category: 'work', patterns: [/vercel\.com/i] },
  { key: 'feishu', label: '飞书', category: 'work', patterns: [/feishu\.cn/i, /lark/i, /\b飞书\b/] },
  { key: 'yuque', label: '语雀', category: 'work', patterns: [/yuque\.com/i, /\b语雀\b/] },
  { key: 'bilibili', label: '哔哩哔哩', category: 'entertainment', patterns: [/bilibili\.com/i, /哔哩哔哩/i] },
  { key: 'youtube', label: 'YouTube', category: 'entertainment', patterns: [/youtube\.com/i, /\byoutube\b/i] },
  { key: 'douyin', label: '抖音', category: 'entertainment', patterns: [/douyin\.com/i, /\b抖音\b/i] },
  { key: 'weibo', label: '微博', category: 'entertainment', patterns: [/weibo\.com/i, /\b微博\b/i] },
  { key: 'zhihu', label: '知乎', category: 'neutral', patterns: [/zhihu\.com/i, /\b知乎\b/i] },
  { key: 'baidu', label: '百度', category: 'neutral', patterns: [/baidu\.com/i, /\b百度\b/i] },
  { key: 'taobao', label: '淘宝', category: 'entertainment', patterns: [/taobao\.com/i, /\b淘宝\b/i] },
  { key: 'jd', label: '京东', category: 'entertainment', patterns: [/jd\.com/i, /\b京东\b/i] },
  { key: 'iqiyi', label: '爱奇艺', category: 'entertainment', patterns: [/iqiyi\.com/i, /\b爱奇艺\b/] },
  { key: 'youku', label: '优酷', category: 'entertainment', patterns: [/youku\.com/i, /\b优酷\b/] },
  { key: 'netflix', label: 'Netflix', category: 'entertainment', patterns: [/netflix\.com/i] },
  { key: 'google', label: 'Google', category: 'neutral', patterns: [/google\.com/i, /google search/i] },
  { key: 'bing', label: 'Bing', category: 'neutral', patterns: [/bing\.com/i] },
  { key: 'devtools', label: '开发者工具', category: 'work', patterns: [/devtools/i, /developer tools/i] }
]

export interface ParsedBrowserSite {
  siteKey: string
  siteLabel: string
  category: AppCategory
  pageTitle: string
}

export function isBrowserProcess(processName: string | null | undefined): boolean {
  if (!processName) {
    return false
  }
  return BROWSER_PROCESSES.has(processName.toLowerCase())
}

export function getBrowserProcessNames(): string[] {
  return [...BROWSER_PROCESSES]
}

export function stripBrowserSuffix(title: string): string {
  return title
    .replace(/\s[-–—|]\s*(Google Chrome|Microsoft Edge|Mozilla Firefox|Chrome|Edge|Firefox|Brave|Opera|Vivaldi)\s*$/i, '')
    .trim()
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'unknown'
}

function matchSiteRule(text: string): (typeof SITE_RULES)[number] | null {
  for (const rule of SITE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule
    }
  }
  return null
}

function detectLocalDev(text: string): boolean {
  return LOCAL_DEV_PATTERN.test(text) || /\blocalhost\b/i.test(text)
}

export function parseBrowserSite(processName: string | null, windowTitle: string | null): ParsedBrowserSite | null {
  if (!isBrowserProcess(processName) || !windowTitle) {
    return null
  }

  const pageTitle = stripBrowserSuffix(windowTitle)
  if (!pageTitle) {
    return null
  }

  const matched = matchSiteRule(pageTitle)
  if (matched) {
    return {
      siteKey: matched.key,
      siteLabel: matched.label,
      category: matched.category,
      pageTitle
    }
  }

  if (detectLocalDev(pageTitle)) {
    return {
      siteKey: 'localhost',
      siteLabel: '本地开发',
      category: 'work',
      pageTitle
    }
  }

  const ipMatch = pageTitle.match(/\b(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?\b/)
  if (ipMatch) {
    return {
      siteKey: `ip-${ipMatch[1]}`,
      siteLabel: `内网 ${ipMatch[1]}`,
      category: 'work',
      pageTitle
    }
  }

  const domainMatch = pageTitle.match(/([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i)
  if (domainMatch) {
    const domain = domainMatch[1].toLowerCase()
    const domainRule = matchSiteRule(domain)
    if (domainRule) {
      return {
        siteKey: domainRule.key,
        siteLabel: domainRule.label,
        category: domainRule.category,
        pageTitle
      }
    }
    return {
      siteKey: slugify(domain),
      siteLabel: domain,
      category: 'neutral',
      pageTitle
    }
  }

  const shortTitle = pageTitle.length > 24 ? `${pageTitle.slice(0, 24)}…` : pageTitle
  return {
    siteKey: slugify(pageTitle),
    siteLabel: shortTitle,
    category: 'neutral',
    pageTitle
  }
}

export function getBrowserSiteIdentity(
  processName: string | null,
  windowTitle: string | null
): string | null {
  const parsed = parseBrowserSite(processName, windowTitle)
  if (!parsed) {
    return null
  }
  return `${processName?.toLowerCase()}::${parsed.siteKey}`
}

export function enrichBrowserSegmentMeta(
  processName: string,
  windowTitle: string | null | undefined
): Pick<ParsedBrowserSite, 'siteKey' | 'siteLabel' | 'category'> | null {
  const parsed = parseBrowserSite(processName, windowTitle ?? null)
  if (!parsed) {
    return null
  }
  return {
    siteKey: parsed.siteKey,
    siteLabel: parsed.siteLabel,
    category: parsed.category
  }
}
