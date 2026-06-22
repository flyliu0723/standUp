import koffi from 'koffi'
import { idleService } from './idleService'
import { settingsService } from './settingsService'

const user32 = koffi.load('user32.dll')
const kernel32 = koffi.load('kernel32.dll')
const psapi = koffi.load('psapi.dll')

const GetForegroundWindow = user32.func('void *GetForegroundWindow()')
const GetWindowThreadProcessId = user32.func(
  'uint32 GetWindowThreadProcessId(void *hWnd, _Out_ uint32 *lpdwProcessId)'
)
const GetWindowTextW = user32.func(
  'int32 GetWindowTextW(void *hWnd, _Out_ uint16 *lpString, int32 nMaxCount)'
)
const OpenProcess = kernel32.func(
  'void *OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)'
)
const CloseHandle = kernel32.func('bool CloseHandle(void *hObject)')
const GetModuleBaseNameW = psapi.func(
  'uint32 GetModuleBaseNameW(void *hProcess, void *hModule, _Out_ uint16 *lpBaseName, uint32 nSize)'
)
const QueryFullProcessImageNameW = kernel32.func(
  'bool QueryFullProcessImageNameW(void *hProcess, uint32 dwFlags, _Out_ uint16 *lpExeName, _Inout_ uint32 *lpdwSize)'
)

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
const PROCESS_QUERY_INFORMATION = 0x0400
const PROCESS_VM_READ = 0x0010
const PROCESS_NAME_WIN32 = 0

const IDE_LABELS: Record<string, string> = {
  'code.exe': 'VS Code',
  'cursor.exe': 'Cursor',
  'devenv.exe': 'Visual Studio',
  'webstorm64.exe': 'WebStorm',
  'idea64.exe': 'IntelliJ IDEA',
  'pycharm64.exe': 'PyCharm',
  'pycharm.exe': 'PyCharm',
  'rider64.exe': 'Rider',
  'windowsterminal.exe': '终端',
  'electron.exe': 'standUp'
}

function getProcessIdFromHwnd(hwnd: unknown): number | null {
  const pidRef: Array<number | null> = [null]
  const tid = GetWindowThreadProcessId(hwnd, pidRef)
  if (!tid) {
    return null
  }
  const pid = pidRef[0]
  if (pid == null || pid === 0) {
    return null
  }
  return pid
}

function basenameFromPath(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

function readProcessNameQueryFull(handle: unknown): string | null {
  const buf = Buffer.alloc(1040)
  const sizeRef = [520]
  const ok = QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, buf, sizeRef)
  if (!ok || sizeRef[0] <= 0) {
    return null
  }
  const path = koffi.decode(buf, 'char16', sizeRef[0])
  return basenameFromPath(path)
}

function readProcessNameModule(handle: unknown): string | null {
  const buf = Buffer.alloc(520)
  const len = GetModuleBaseNameW(handle, null, buf, 260)
  if (len <= 0) {
    return null
  }
  return koffi.decode(buf, 'char16', len)
}

function readProcessBaseName(processId: number): string | null {
  if (process.platform !== 'win32' || processId === 0) {
    return null
  }

  let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, processId)
  if (handle) {
    try {
      const name = readProcessNameQueryFull(handle)
      if (name) {
        return name
      }
    } catch {
      // fallback below
    } finally {
      CloseHandle(handle)
    }
  }

  handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, processId)
  if (!handle) {
    return null
  }
  try {
    return readProcessNameModule(handle)
  } catch {
    return null
  } finally {
    CloseHandle(handle)
  }
}

export function getForegroundWindowTitle(): string | null {
  if (process.platform !== 'win32') {
    return null
  }
  try {
    const hwnd = GetForegroundWindow()
    if (!hwnd) {
      return null
    }
    const buf = Buffer.alloc(1024)
    const len = GetWindowTextW(hwnd, buf, 512)
    if (len <= 0) {
      return null
    }
    return koffi.decode(buf, 'char16', len)
  } catch {
    return null
  }
}

export function getForegroundProcessName(): string | null {
  if (process.platform !== 'win32') {
    return null
  }
  try {
    const hwnd = GetForegroundWindow()
    if (!hwnd) {
      return null
    }
    const pid = getProcessIdFromHwnd(hwnd)
    if (!pid) {
      return null
    }
    return readProcessBaseName(pid)
  } catch {
    return null
  }
}

export function getForegroundIdeLabel(): string | null {
  const name = getForegroundProcessName()
  if (!name) {
    return null
  }
  const lower = name.toLowerCase()
  return IDE_LABELS[lower] ?? IDE_LABELS[name] ?? null
}

export function shouldOfferIdeDefer(): boolean {
  const settings = settingsService.getSettings()
  if (!settings.enableIdeGuard) {
    return false
  }
  const label = getForegroundIdeLabel()
  if (!label) {
    return false
  }
  const thresholdMs = settings.ideActiveThresholdSeconds * 1000
  return idleService.getIdleMs() < thresholdMs
}

export function getIdeGuardContext(): { label: string; idleMs: number } | null {
  const label = getForegroundIdeLabel()
  if (!label) {
    return null
  }
  return { label, idleMs: idleService.getIdleMs() }
}
