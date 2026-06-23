import { Notification } from 'electron'
import Store from 'electron-store'
import { buildAiAnalysisPayload } from '../utils/aiAnalysisPayload'
import { appUsageService } from './appUsageService'
import { settingsService } from './settingsService'
import { statsService } from './statsService'
import type { AiDailyAnalysis, AiProvider, AppSettings } from '../types/session'

interface AiStoreSchema {
  analyses: Record<string, AiDailyAnalysis>
}

const PROVIDER_DEFAULTS: Record<
  Exclude<AiProvider, 'custom'>,
  { baseUrl: string; model: string }
> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini'
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat'
  }
}

const SYSTEM_PROMPT = `# Role
你是一位兼具人体工程学与认知心理学视角的健康搭档，服务对象是资深前端 / Vibe Coding 工程师。你崇尚「非侵入式」与顺应心智流动（Flow）的健康管理，任务是审计用户一天的坐立健康与多应用切换日志，输出一份【无痛、懂他、直击潜意识习惯】的断电复盘。

# Tone
像并肩作战的资深搭档或懂他的设计大佬：可以有一点极客冷幽默，但务必具体、可验证。
严禁：教条式命令、爹味说教（如「克服拖延」「铃响即起」）、堆砌冰冷百分比、空泛鸡汤、未结合日志的泛泛而谈。

# Audit Dimensions（必须基于 JSON 数据交叉分析，禁止只做数字加减法）
1. 【抗拒起身的心智诱因】：结合 delayEvents（推迟提醒）、peakSittingHours、execution（延迟/忽略）、sittingTimeline，分析「明知该站却站不起来」的时段。是多线程超频的心智粘性，还是与 AI 死磕的盲区？
2. 【伪高效与精神超频】：结合 appDistribution.hourlyPattern、topApps（若有）、ruleInsights，找出肉体在坐但大脑因频繁切应用而「精神 OOM」的节点。
3. 【顺水推舟的破局点】：从日志中找最适合起身的黄金断点（任务间隙、AI 生成等待期、高频乱切开始变慢的疲劳期），策略必须能嵌入现有工作流，而非强行打断。

# Output（只输出 JSON，不要 markdown 代码块，不要任何额外说明）
字段与语义映射：
- summary：对应「今日心智与肉体硬核复盘」，2-3 句直击今天最隐蔽的一个行为坏习惯及其背后心理状态。
- highlights：固定 2 条，对应「行为微观切片」：
  1) 以「粘在椅子上的黑洞：」开头，写下午/重灾区连续久坐与延迟响应的真实原因；
  2) 以「脑内存溢出点：」开头，写应用高频切换与健康崩盘的重合点。
- suggestions：固定 2 条，对应「无痛微调」：
  1) 以「微调 1：」开头，针对重灾区给一个无感降级策略（可结合 AI 烘焙期、等编译、呼吸条等场景）；
  2) 以「微调 2：」开头，说明如何利用工作流断点起立。
- tomorrowTip：1 句明日行动提示，具体、可执行、顺应工作流。

# Constraints
- 优先引用日志中的时段（如 14:00-18:00）、应用名或行为模式；数据不足时诚实说明，不要编造。
- 数字仅作佐证，每条建议不超过 2 个数字，避免报告体。
- 全部使用简体中文。`

const USER_PROMPT_PREFIX = `请根据以下 standUp 用户今日健康与行为日志，完成断电复盘。请严格按 system 要求输出 JSON：`

const store = new Store<AiStoreSchema>({
  name: 'standup-ai-analysis',
  defaults: {
    analyses: {}
  }
})

function todayKey(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function normalizeChatCompletionsUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '')
  if (!url) {
    return url
  }
  if (/\/chat\/completions$/i.test(url)) {
    return url
  }
  if (/\/v1$/i.test(url)) {
    return `${url}/chat/completions`
  }
  if (/^https?:\/\/[^/]+$/i.test(url)) {
    return `${url}/v1/chat/completions`
  }
  return `${url}/chat/completions`
}

function resolveEndpoint(settings: AppSettings): { url: string; model: string } | null {
  if (!settings.aiApiKey.trim()) {
    return null
  }

  const customUrl = settings.aiBaseUrl.trim()
  const model = settings.aiModel.trim()

  if (settings.aiProvider === 'custom') {
    if (!customUrl || !model) {
      return null
    }
    return { url: normalizeChatCompletionsUrl(customUrl), model }
  }

  const defaults = PROVIDER_DEFAULTS[settings.aiProvider]
  const url = customUrl ? normalizeChatCompletionsUrl(customUrl) : defaults.baseUrl
  return {
    url,
    model: model || defaults.model
  }
}

function extractJsonContent(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(candidate) as Record<string, unknown>
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 4)
}

function parseAiResponse(raw: string): Pick<
  AiDailyAnalysis,
  'summary' | 'highlights' | 'suggestions' | 'tomorrowTip'
> {
  const parsed = extractJsonContent(raw)
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
  const highlights = normalizeStringArray(parsed.highlights)
  const suggestions = normalizeStringArray(parsed.suggestions)
  const tomorrowTip = typeof parsed.tomorrowTip === 'string' ? parsed.tomorrowTip.trim() : ''

  if (!summary) {
    throw new Error('AI 返回内容缺少 summary 字段')
  }

  return { summary, highlights, suggestions, tomorrowTip }
}

function saveAnalysis(analysis: AiDailyAnalysis): AiDailyAnalysis {
  const all = store.get('analyses')
  all[analysis.date] = analysis
  store.set('analyses', all)
  return analysis
}

function showAnalysisNotification(analysis: AiDailyAnalysis): void {
  if (!Notification.isSupported() || analysis.status !== 'ready' || !analysis.summary) {
    return
  }
  const notification = new Notification({
    title: 'standUp — 今日 AI 复盘',
    body: analysis.summary.slice(0, 180),
    silent: false
  })
  notification.show()
}

export class AiAnalysisService {
  private generatingDates = new Set<string>()

  getAnalysis(date: string): AiDailyAnalysis | null {
    return store.get('analyses')[date] ?? null
  }

  triggerOnWorkEnd(): void {
    const settings = settingsService.getSettings()
    if (!settings.enableAiDailyAnalysis || !settings.aiTriggerOnWorkEnd) {
      return
    }
    void this.generate(todayKey(), { notify: true })
  }

  async generate(
    date: string,
    options?: { force?: boolean; notify?: boolean }
  ): Promise<AiDailyAnalysis> {
    const settings = settingsService.getSettings()
    if (!settings.enableAiDailyAnalysis) {
      return {
        date,
        status: 'error',
        error: '请先在设置中开启 AI 日终分析'
      }
    }

    const cached = this.getAnalysis(date)
    if (cached?.status === 'ready' && !options?.force) {
      return cached
    }

    if (this.generatingDates.has(date)) {
      return cached ?? { date, status: 'generating' }
    }

    const endpoint = resolveEndpoint(settings)
    if (!endpoint) {
      const errorAnalysis: AiDailyAnalysis = {
        date,
        status: 'error',
        error: '请先配置 AI API Key' + (settings.aiProvider === 'custom' ? '、接口地址和模型' : '（自定义服务商还需填写接口地址与模型）')
      }
      saveAnalysis(errorAnalysis)
      return errorAnalysis
    }

    this.generatingDates.add(date)
    const pending: AiDailyAnalysis = { date, status: 'generating' }
    saveAnalysis(pending)

    try {
      const daily = statsService.getStatsByDate(date)
      const report = statsService.getReportSummary(date)
      const appUsage = appUsageService.getDailySummary(date)
      const payload = buildAiAnalysisPayload({
        date,
        daily,
        report,
        appUsage,
        settings,
        includeAppNames: settings.aiIncludeAppNames
      })

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.aiApiKey.trim()}`
        },
        body: JSON.stringify({
          model: endpoint.model,
          temperature: 0.55,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `${USER_PROMPT_PREFIX}\n${JSON.stringify(payload, null, 2)}`
            }
          ]
        }),
        signal: AbortSignal.timeout(60_000)
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        const detail = errText ? `: ${errText.slice(0, 120)}` : ''
        if (response.status === 404) {
          throw new Error(
            `API 地址无效 (404)：请确认接口地址正确，需为完整路径或基址（如 https://api.deepseek.com），将自动补全为 …/v1/chat/completions${detail}`
          )
        }
        throw new Error(`API 请求失败 (${response.status})${detail}`)
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = data.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('AI 返回内容为空')
      }

      const parsed = parseAiResponse(content)
      const ready: AiDailyAnalysis = {
        date,
        status: 'ready',
        generatedAt: Date.now(),
        ...parsed
      }
      saveAnalysis(ready)
      if (options?.notify) {
        showAnalysisNotification(ready)
      }
      return ready
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 分析失败'
      const failed: AiDailyAnalysis = {
        date,
        status: 'error',
        error: message
      }
      saveAnalysis(failed)
      return failed
    } finally {
      this.generatingDates.delete(date)
    }
  }
}

export const aiAnalysisService = new AiAnalysisService()
