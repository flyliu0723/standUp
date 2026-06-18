import holidaysData from '../data/chinaHolidays.json'

const HOLIDAYS = new Set(holidaysData.holidays)
const COMPENSATORY_WORKDAYS = new Set(holidaysData.workdays)

function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/** 是否为法定节假日或周末休息日（考虑调休上班日） */
export function isRestDay(date: Date = new Date()): boolean {
  const key = formatDateKey(date)

  if (COMPENSATORY_WORKDAYS.has(key)) {
    return false
  }

  if (HOLIDAYS.has(key)) {
    return true
  }

  return isWeekend(date)
}

export function isLegalHoliday(date: Date = new Date()): boolean {
  return HOLIDAYS.has(formatDateKey(date))
}
