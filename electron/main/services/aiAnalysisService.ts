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

const SYSTEM_PROMPT = `你是 standUp 久坐健康助手。根据用户提供的每日健康数据 JSON，生成简洁、可执行的健康复盘。
必须只输出 JSON，不要 markdown，不要额外说明。字段要求：
- summary: string，2-3 句总评，聚焦颈椎/腰椎/久坐风险
- highlights: string[]，2-4 条今日亮点或主要问题
- suggestions: string[]，2-4 条具体可执行建议（可含提醒间隔、时段策略等）
- tomorrowTip: string，1 句明日行动提示
语气鼓励但直接，避免空泛鸡汤。`

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

function resolveEndpoint(settings: AppSettings): { url: string; model: string } | null {
  if (!settings.aiApiKey.trim()) {
    return null
  }

  if (settings.aiProvider === 'custom') {
    const url = settings.aiBaseUrl.trim()
    const model = settings.aiModel.trim()
    if (!url || !model) {
      return null
    }
    return { url, model }
  }

  const defaults = PROVIDER_DEFAULTS[settings.aiProvider]
  return {
    url: defaults.baseUrl,
    model: settings.aiModel.trim() || defaults.model
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
        error: '请先配置 AI API Key' + (settings.aiProvider === 'custom' ? '、接口地址和模型' : '')
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
          temperature: 0.4,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `请分析以下 standUp 用户今日健康数据：\n${JSON.stringify(payload, null, 2)}`
            }
          ]
        }),
        signal: AbortSignal.timeout(60_000)
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        throw new Error(`API 请求失败 (${response.status})${errText ? `: ${errText.slice(0, 120)}` : ''}`)
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
