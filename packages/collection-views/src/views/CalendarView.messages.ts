import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// CalendarView 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const EN_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

const M = {
  weekdayLabels: {
    default: ['일', '월', '화', '수', '목', '금', '토'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    'zh-Hans': ['日', '一', '二', '三', '四', '五', '六'],
  } satisfies Localized<string[]>,
  monthLabel: {
    default: '{year}년 {month}월',
    en: '{monthName} {year}',
    'zh-Hans': '{year}年{month}月',
  } satisfies Localized,
  titleNone: {
    default: '제목 없음',
    en: 'Untitled',
    'zh-Hans': '无标题',
  } satisfies Localized,
  prevMonth: {
    default: '이전 달',
    en: 'Previous month',
    'zh-Hans': '上个月',
  } satisfies Localized,
  nextMonth: {
    default: '다음 달',
    en: 'Next month',
    'zh-Hans': '下个月',
  } satisfies Localized,
  needDateProp: {
    default: '캘린더로 보려면 날짜 속성이 필요합니다',
    en: 'A date property is required for the calendar view',
    'zh-Hans': '日历视图需要一个日期属性',
  } satisfies Localized,
  needDatePropHint: {
    default: 'date 타입 속성을 추가하면 월 그리드가 표시됩니다.',
    en: 'Add a date-type property to show the month grid.',
    'zh-Hans': '添加日期类型属性后即可显示月历网格。',
  } satisfies Localized,
}

export function calendarViewCopy(locale: CollectionLocale) {
  return {
    weekdayLabels: pickLocalized(M.weekdayLabels, locale),
    monthLabel: (year: number, month0: number) =>
      pickLocalized(M.monthLabel, locale)
        .replace('{year}', String(year))
        .replace('{month}', String(month0 + 1))
        .replace('{monthName}', EN_MONTHS[month0] ?? String(month0 + 1)),
    titleNone: pickLocalized(M.titleNone, locale),
    prevMonth: pickLocalized(M.prevMonth, locale),
    nextMonth: pickLocalized(M.nextMonth, locale),
    needDateProp: pickLocalized(M.needDateProp, locale),
    needDatePropHint: pickLocalized(M.needDatePropHint, locale),
  }
}
