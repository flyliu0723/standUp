import type { GlobalThemeOverrides } from 'naive-ui'

export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#16a34a',
    primaryColorHover: '#15803d',
    primaryColorPressed: '#166534',
    primaryColorSuppl: '#22c55e',
    borderRadius: '12px',
    borderRadiusSmall: '10px',
    fontFamily: "'Inter', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontFamilyMono: "'Cascadia Code', 'Consolas', monospace",
    textColor1: '#0f172a',
    textColor2: '#334155',
    textColor3: '#64748b',
    dividerColor: 'rgba(148, 163, 184, 0.18)',
    borderColor: 'rgba(226, 232, 240, 0.9)',
    hoverColor: 'rgba(241, 245, 249, 0.8)',
    cardColor: 'rgba(255, 255, 255, 0.78)',
    modalColor: '#ffffff',
    bodyColor: 'transparent',
    popoverColor: '#ffffff',
    boxShadow1: '0 2px 8px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.03)',
    boxShadow2: '0 4px 16px rgba(15, 23, 42, 0.06), 0 12px 32px rgba(15, 23, 42, 0.04)'
  },
  Button: {
    borderRadiusTiny: '8px',
    borderRadiusSmall: '10px',
    borderRadiusMedium: '12px',
    borderRadiusLarge: '14px',
    heightTiny: '28px',
    heightSmall: '32px',
    heightMedium: '36px',
    heightLarge: '44px',
    fontWeight: '600'
  },
  Input: {
    borderRadius: '12px',
    heightMedium: '36px',
    heightLarge: '40px'
  },
  Select: {
    peers: {
      InternalSelection: {
        borderRadius: '12px',
        heightMedium: '36px'
      }
    }
  },
  Switch: {
    railBorderRadius: '12px',
    buttonBorderRadius: '10px'
  },
  Radio: {
    buttonBorderRadius: '12px'
  },
  Tabs: {
    tabBorderRadius: '12px',
    tabGapMediumLine: '24px'
  },
  Card: {
    borderRadius: '16px'
  },
  Message: {
    borderRadius: '12px'
  }
}
