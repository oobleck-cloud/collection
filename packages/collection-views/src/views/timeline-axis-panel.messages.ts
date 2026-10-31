import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// TimelineAxisPanel 문구(로캘별) — co-located vocab 패턴. ko(default)는 기존 하드코딩과 바이트 동일(파리티),
// en·zh-Hans 는 관용 번역.
const M = {
  zoomDay: {
    default: '일(Day)',
    en: 'Day',
    'zh-Hans': '日',
  } satisfies Localized,
  zoomWeek: {
    default: '주(Week)',
    en: 'Week',
    'zh-Hans': '周',
  } satisfies Localized,
  zoomMonth: {
    default: '월(Month)',
    en: 'Month',
    'zh-Hans': '月',
  } satisfies Localized,
  zoomQuarter: {
    default: '분기(Quarter)',
    en: 'Quarter',
    'zh-Hans': '季度',
  } satisfies Localized,
  startDateLabel: {
    default: '시작 날짜 속성',
    en: 'Start date property',
    'zh-Hans': '开始日期属性',
  } satisfies Localized,
  selectPlaceholder: {
    default: '선택하세요',
    en: 'Select',
    'zh-Hans': '请选择',
  } satisfies Localized,
  noneOption: {
    default: '없음',
    en: 'None',
    'zh-Hans': '无',
  } satisfies Localized,
  endDateLabel: {
    default: '종료 날짜 속성 (선택)',
    en: 'End date property (optional)',
    'zh-Hans': '结束日期属性（可选）',
  } satisfies Localized,
  noDatePropsHint: {
    default: 'date 타입 속성을 추가하면 타임라인을 설정할 수 있습니다.',
    en: 'Add a date property to configure the timeline.',
    'zh-Hans': '添加日期类型属性后即可设置时间轴。',
  } satisfies Localized,
  endDateHint: {
    default: '설정 시 기간 막대, 미설정 시 점 막대.',
    en: 'Set for a range bar, leave empty for a point marker.',
    'zh-Hans': '设置后显示为区间条，未设置时显示为点。',
  } satisfies Localized,
  zoomLabel: {
    default: '눈금 단위',
    en: 'Scale unit',
    'zh-Hans': '刻度单位',
  } satisfies Localized,
  slotLabel: {
    default: '타임라인 축',
    en: 'Timeline axis',
    'zh-Hans': '时间轴',
  } satisfies Localized,
}

export function timelineAxisPanelCopy(locale: CollectionLocale) {
  return {
    zoomDay: pickLocalized(M.zoomDay, locale),
    zoomWeek: pickLocalized(M.zoomWeek, locale),
    zoomMonth: pickLocalized(M.zoomMonth, locale),
    zoomQuarter: pickLocalized(M.zoomQuarter, locale),
    startDateLabel: pickLocalized(M.startDateLabel, locale),
    selectPlaceholder: pickLocalized(M.selectPlaceholder, locale),
    noneOption: pickLocalized(M.noneOption, locale),
    endDateLabel: pickLocalized(M.endDateLabel, locale),
    noDatePropsHint: pickLocalized(M.noDatePropsHint, locale),
    endDateHint: pickLocalized(M.endDateHint, locale),
    zoomLabel: pickLocalized(M.zoomLabel, locale),
    slotLabel: pickLocalized(M.slotLabel, locale),
  }
}
