import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// GroupPanel 문구(로캘별) — co-located vocab 패턴. ko(default)는 기존 하드코딩과 바이트 동일(파리티),
// en·zh-Hans 는 관용 번역.
const M = {
  noCandidatesTitle: {
    default: '그룹 기준으로 사용할 수 있는 컬럼이 없습니다.',
    en: 'No columns available to group by.',
    'zh-Hans': '没有可用于分组的列。',
  } satisfies Localized,
  noCandidatesHint: {
    default: 'select 또는 multi_select 타입 컬럼을 추가하면 그룹핑을 설정할 수 있습니다.',
    en: 'Add a select or multi_select column to configure grouping.',
    'zh-Hans': '添加 select 或 multi_select 类型的列后即可设置分组。',
  } satisfies Localized,
  noGroup: {
    default: '그룹 없음',
    en: 'No grouping',
    'zh-Hans': '不分组',
  } satisfies Localized,
  multiBadge: {
    default: '다중',
    en: 'Multi',
    'zh-Hans': '多选',
  } satisfies Localized,
  fanOutHint: {
    default: '한 카드가 선택된 모든 그룹에 표시됩니다.',
    en: 'A card appears in every selected group.',
    'zh-Hans': '一张卡片会显示在所有所选分组中。',
  } satisfies Localized,
  hideEmptyGroups: {
    default: '빈 그룹 숨기기',
    en: 'Hide empty groups',
    'zh-Hans': '隐藏空分组',
  } satisfies Localized,
  groupSort: {
    default: '그룹 정렬',
    en: 'Group sort',
    'zh-Hans': '分组排序',
  } satisfies Localized,
  sortManual: {
    default: '수동(등장 순)',
    en: 'Manual (appearance)',
    'zh-Hans': '手动（出现顺序）',
  } satisfies Localized,
  sortName: {
    default: '이름 순',
    en: 'By name',
    'zh-Hans': '按名称',
  } satisfies Localized,
  sortCount: {
    default: '개수 순',
    en: 'By count',
    'zh-Hans': '按数量',
  } satisfies Localized,
}

export function groupPanelCopy(locale: CollectionLocale) {
  return {
    noCandidatesTitle: pickLocalized(M.noCandidatesTitle, locale),
    noCandidatesHint: pickLocalized(M.noCandidatesHint, locale),
    noGroup: pickLocalized(M.noGroup, locale),
    multiBadge: pickLocalized(M.multiBadge, locale),
    fanOutHint: pickLocalized(M.fanOutHint, locale),
    hideEmptyGroups: pickLocalized(M.hideEmptyGroups, locale),
    groupSort: pickLocalized(M.groupSort, locale),
    sortManual: pickLocalized(M.sortManual, locale),
    sortName: pickLocalized(M.sortName, locale),
    sortCount: pickLocalized(M.sortCount, locale),
  }
}
