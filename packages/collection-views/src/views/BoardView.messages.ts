import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// BoardView 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const M = {
  groupNone: {
    default: '없음',
    en: 'None',
    'zh-Hans': '无',
  } satisfies Localized,
  pickGroup: {
    default: '그룹 기준 속성을 선택하세요(상단 보기 옵션 → 그룹).',
    en: 'Select a property to group by (top view options → Group).',
    'zh-Hans': '请选择分组依据的属性（顶部视图选项 → 分组）。',
  } satisfies Localized,
  empty: {
    default: '비어 있음',
    en: 'Empty',
    'zh-Hans': '空',
  } satisfies Localized,
  newCard: {
    default: '새 카드',
    en: 'New card',
    'zh-Hans': '新建卡片',
  } satisfies Localized,
}

export function boardViewCopy(locale: CollectionLocale) {
  return {
    groupNone: pickLocalized(M.groupNone, locale),
    pickGroup: pickLocalized(M.pickGroup, locale),
    empty: pickLocalized(M.empty, locale),
    newCard: pickLocalized(M.newCard, locale),
  }
}
