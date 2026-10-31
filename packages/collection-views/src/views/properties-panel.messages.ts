import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// PropertiesPanel 문구(로캘별) — co-located vocab 패턴. ko(default)는 기존 하드코딩과 바이트 동일(파리티),
// en·zh-Hans 는 관용 번역.
const M = {
  showing: {
    default: '표시 중',
    en: 'Showing',
    'zh-Hans': '显示中',
  } satisfies Localized,
  hideAll: {
    default: '모두 숨기기',
    en: 'Hide all',
    'zh-Hans': '全部隐藏',
  } satisfies Localized,
  noVisibleProps: {
    default: '표시 중인 프로퍼티가 없습니다.',
    en: 'No properties are shown.',
    'zh-Hans': '没有正在显示的属性。',
  } satisfies Localized,
  reorderAria: {
    default: '{label} 순서 변경',
    en: 'Reorder {label}',
    'zh-Hans': '调整{label}顺序',
  } satisfies Localized,
  hideAria: {
    default: '{label} 숨기기',
    en: 'Hide {label}',
    'zh-Hans': '隐藏{label}',
  } satisfies Localized,
  hidden: {
    default: '숨김',
    en: 'Hidden',
    'zh-Hans': '已隐藏',
  } satisfies Localized,
  showAll: {
    default: '모두 표시',
    en: 'Show all',
    'zh-Hans': '全部显示',
  } satisfies Localized,
  showAria: {
    default: '{label} 표시하기',
    en: 'Show {label}',
    'zh-Hans': '显示{label}',
  } satisfies Localized,
  allShown: {
    default: '모든 속성이 표시되고 있습니다.',
    en: 'All properties are shown.',
    'zh-Hans': '所有属性都已显示。',
  } satisfies Localized,
  slotLabel: {
    default: '프로퍼티',
    en: 'Properties',
    'zh-Hans': '属性',
  } satisfies Localized,
}

export function propertiesPanelCopy(locale: CollectionLocale) {
  return {
    showing: pickLocalized(M.showing, locale),
    hideAll: pickLocalized(M.hideAll, locale),
    noVisibleProps: pickLocalized(M.noVisibleProps, locale),
    reorderAria: (label: string) => pickLocalized(M.reorderAria, locale).replace('{label}', label),
    hideAria: (label: string) => pickLocalized(M.hideAria, locale).replace('{label}', label),
    hidden: pickLocalized(M.hidden, locale),
    showAll: pickLocalized(M.showAll, locale),
    showAria: (label: string) => pickLocalized(M.showAria, locale).replace('{label}', label),
    allShown: pickLocalized(M.allShown, locale),
    slotLabel: pickLocalized(M.slotLabel, locale),
  }
}
