import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// RelationTable(관계 표) 문구(로캘별). 셈 단위(「곳」·「건」)는 호스트가 provider 로 준다 — 없으면 로캘 기본.
const M = {
  more: {
    default: '+ {count}{unit} 더',
    en: '+ {count} more',
    'zh-Hans': '另有 {count} 项',
  } satisfies Localized,
  defaultUnit: {
    default: '개',
    en: '',
    'zh-Hans': '',
  } satisfies Localized,
  // 접어 둔 관계 표의 한 줄 — 「견적 3곳 보기」. 이름(관계 속성 라벨)이 없으면 「3곳 보기」.
  show: {
    default: '{label} {count}{unit} 보기',
    en: 'Show {count} {label}',
    'zh-Hans': '查看 {label} {count} 项',
  } satisfies Localized,
  // 'rows' 모양의 머리말 — 「견적 4곳 · 눌러서 네고 콜」. 동작이 없으면 「견적 4곳」.
  rowsCaption: {
    default: '{label} {count}{unit}',
    en: '{count} {label}',
    'zh-Hans': '{label} {count} 项',
  } satisfies Localized,
  rowsAction: {
    default: '눌러서 {action}',
    en: 'click to {action}',
    'zh-Hans': '点击{action}',
  } satisfies Localized,
  actions: {
    default: '동작',
    en: 'Actions',
    'zh-Hans': '操作',
  } satisfies Localized,
}

export function relationTableCopy(locale: CollectionLocale) {
  return {
    more: (count: number, unit: string | undefined) =>
      pickLocalized(M.more, locale)
        .replace('{count}', String(count))
        .replace('{unit}', unit ?? pickLocalized(M.defaultUnit, locale)),
    show: (label: string | undefined, count: number, unit: string | undefined) =>
      pickLocalized(M.show, locale)
        .replace('{label}', label ?? '')
        .replace('{count}', String(count))
        .replace('{unit}', unit ?? pickLocalized(M.defaultUnit, locale))
        .replace(/\s+/g, ' ')
        .trim(),
    rowsCaption: (
      label: string | undefined,
      count: number,
      unit: string | undefined,
      action: string | undefined,
    ) => {
      const head = pickLocalized(M.rowsCaption, locale)
        .replace('{label}', label ?? '')
        .replace('{count}', String(count))
        .replace('{unit}', unit ?? pickLocalized(M.defaultUnit, locale))
        .replace(/\s+/g, ' ')
        .trim()
      return action
        ? `${head} · ${pickLocalized(M.rowsAction, locale).replace('{action}', action)}`
        : head
    },
    actions: pickLocalized(M.actions, locale),
  }
}
