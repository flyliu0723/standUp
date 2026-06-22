import { enrichBrowserSegmentMeta, isBrowserProcess, getBrowserProcessNames } from '../utils/browserTitleParser'

export type AppCategory = 'work' | 'entertainment' | 'social' | 'neutral'

export interface AppCatalogEntry {
  processName: string
  label: string
  defaultCategory: AppCategory
}

export interface AppCategoryConfigItem extends AppCatalogEntry {
  effectiveCategory: AppCategory
  isOverridden: boolean
  source: 'builtin' | 'observed'
  isBrowser: boolean
  categoryEditable: boolean
}

const WORK_PROCESS_NAMES = new Set([
  'code.exe',
  'cursor.exe',
  'devenv.exe',
  'webstorm64.exe',
  'idea64.exe',
  'pycharm64.exe',
  'pycharm.exe',
  'rider64.exe',
  'windowsterminal.exe',
  'wt.exe',
  'powershell.exe',
  'cmd.exe',
  'figma.exe',
  'notion.exe',
  'obsidian.exe',
  'excel.exe',
  'winword.exe',
  'powerpnt.exe'
])

const SOCIAL_PROCESS_NAMES = new Set([
  'wechat.exe',
  'wechatappex.exe',
  'wxwork.exe',
  'qq.exe',
  'telegram.exe',
  'teams.exe',
  'slack.exe',
  'dingtalk.exe'
])

const ENTERTAINMENT_PROCESS_NAMES = new Set([
  'steam.exe',
  'steamwebhelper.exe',
  'epicgameslauncher.exe',
  'battle.net.exe',
  'league of legends.exe',
  'valorant.exe',
  'genshinimpact.exe',
  'spotify.exe',
  'cloudmusic.exe',
  'qqmusic.exe',
  'potplayer.exe',
  'vlc.exe',
  'mpv.exe'
])

const ENTERTAINMENT_TITLE_KEYWORDS = [
  'bilibili',
  '哔哩哔哩',
  'youtube',
  'netflix',
  'twitch',
  '抖音',
  'douyin',
  '爱奇艺',
  '腾讯视频',
  'youku',
  '优酷',
  'steam',
  '游戏'
]

const CATEGORY_LABELS: Record<AppCategory, string> = {
  work: '工作',
  entertainment: '娱乐',
  social: '社交',
  neutral: '其他'
}

const WORK_LABELS: Record<string, string> = {
  'code.exe': 'VS Code',
  'cursor.exe': 'Cursor',
  'electron.exe': 'standUp',
  'devenv.exe': 'Visual Studio',
  'webstorm64.exe': 'WebStorm',
  'idea64.exe': 'IntelliJ IDEA',
  'pycharm64.exe': 'PyCharm',
  'pycharm.exe': 'PyCharm',
  'rider64.exe': 'Rider',
  'windowsterminal.exe': '终端',
  'wt.exe': '终端',
  'chrome.exe': 'Chrome',
  'msedge.exe': 'Edge',
  'firefox.exe': 'Firefox',
  'figma.exe': 'Figma',
  'notion.exe': 'Notion',
  'obsidian.exe': 'Obsidian',
  'wechat.exe': '微信',
  'wxwork.exe': '企业微信',
  'teams.exe': 'Teams',
  'slack.exe': 'Slack',
  'dingtalk.exe': '钉钉',
  'qq.exe': 'QQ'
}

export function getCategoryLabel(category: AppCategory): string {
  return CATEGORY_LABELS[category]
}

export function getDefaultCategory(
  processName: string | null,
  windowTitle?: string | null
): AppCategory {
  return classifyBuiltin(processName, windowTitle)
}

export function getBuiltinAppCatalog(): AppCatalogEntry[] {
  const map = new Map<string, AppCatalogEntry>()

  const addEntries = (names: Set<string>, category: AppCategory): void => {
    for (const processName of names) {
      map.set(processName, {
        processName,
        label: getAppLabel(processName) ?? processName.replace(/\.exe$/i, ''),
        defaultCategory: category
      })
    }
  }

  addEntries(SOCIAL_PROCESS_NAMES, 'social')
  addEntries(WORK_PROCESS_NAMES, 'work')
  addEntries(ENTERTAINMENT_PROCESS_NAMES, 'entertainment')

  for (const processName of getBrowserProcessNames()) {
    if (!map.has(processName)) {
      map.set(processName, {
        processName,
        label: getAppLabel(processName) ?? processName.replace(/\.exe$/i, ''),
        defaultCategory: 'neutral'
      })
    }
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
}

function classifyBuiltin(processName: string | null, windowTitle?: string | null): AppCategory {
  if (!processName) {
    return 'neutral'
  }
  const lower = processName.toLowerCase()
  if (SOCIAL_PROCESS_NAMES.has(lower)) {
    return 'social'
  }
  if (WORK_PROCESS_NAMES.has(lower)) {
    return 'work'
  }
  if (ENTERTAINMENT_PROCESS_NAMES.has(lower)) {
    return 'entertainment'
  }
  const title = (windowTitle || '').toLowerCase()
  if (title && ENTERTAINMENT_TITLE_KEYWORDS.some((kw) => title.includes(kw))) {
    return 'entertainment'
  }
  if (isBrowserProcess(lower)) {
    const browserMeta = enrichBrowserSegmentMeta(processName, windowTitle)
    if (browserMeta) {
      return browserMeta.category
    }
    if (title.includes('devtools') || title.includes('developer tools')) {
      return 'work'
    }
    if (ENTERTAINMENT_TITLE_KEYWORDS.some((kw) => title.includes(kw))) {
      return 'entertainment'
    }
  }
  return 'neutral'
}

export function classifyProcess(
  processName: string | null,
  windowTitle?: string | null,
  overrides?: Record<string, AppCategory>
): AppCategory {
  if (!processName) {
    return 'neutral'
  }
  const lower = processName.toLowerCase()
  if (!isBrowserProcess(lower) && overrides?.[lower]) {
    return overrides[lower]
  }
  return classifyBuiltin(processName, windowTitle)
}

export function getAppLabel(processName: string | null): string | null {
  if (!processName) {
    return null
  }
  return WORK_LABELS[processName.toLowerCase()] ?? processName.replace(/\.exe$/i, '')
}
