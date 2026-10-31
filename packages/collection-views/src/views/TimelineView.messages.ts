import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// TimelineView 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const M = {
  titleNone: {
    default: '제목 없음',
    en: 'Untitled',
    'zh-Hans': '无标题',
  } satisfies Localized,
  noDateCols: {
    default: '날짜 속성이 없습니다',
    en: 'No date property',
    'zh-Hans': '没有日期属性',
  } satisfies Localized,
  pickDateProp: {
    default: '타임라인 기준 날짜 속성을 선택하세요',
    en: 'Select a date property for the timeline',
    'zh-Hans': '请选择时间线的日期属性',
  } satisfies Localized,
  noDateColsHint: {
    default: '타임라인을 사용하려면 date 타입 속성을 추가하세요.',
    en: 'Add a date-type property to use the timeline.',
    'zh-Hans': '要使用时间线，请添加日期类型属性。',
  } satisfies Localized,
  pickDatePropHint: {
    default: '뷰 옵션(⋯) → 타임라인 축 설정에서 시작 날짜 속성을 지정하세요.',
    en: 'In View options (⋯) → Timeline axis, set the start date property.',
    'zh-Hans': '在视图选项(⋯) → 时间线轴设置中指定开始日期属性。',
  } satisfies Localized,
  noValidDates: {
    default: '날짜 값이 있는 레코드가 없습니다.',
    en: 'No records have a date value.',
    'zh-Hans': '没有包含日期值的记录。',
  } satisfies Localized,
  noDateSuffix: {
    default: '{title} (날짜 없음)',
    en: '{title} (no date)',
    'zh-Hans': '{title}（无日期）',
  } satisfies Localized,
}

export function timelineViewCopy(locale: CollectionLocale) {
  return {
    titleNone: pickLocalized(M.titleNone, locale),
    noDateCols: pickLocalized(M.noDateCols, locale),
    pickDateProp: pickLocalized(M.pickDateProp, locale),
    noDateColsHint: pickLocalized(M.noDateColsHint, locale),
    pickDatePropHint: pickLocalized(M.pickDatePropHint, locale),
    noValidDates: pickLocalized(M.noValidDates, locale),
    noDateSuffix: (title: string) =>
      pickLocalized(M.noDateSuffix, locale).replace('{title}', title),
  }
}
