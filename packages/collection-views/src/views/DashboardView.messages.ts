import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// DashboardView 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const M = {
  noRecords: {
    default: '레코드가 없습니다.',
    en: 'No records yet.',
    'zh-Hans': '暂无记录。',
  } satisfies Localized,
  totalRecords: {
    default: '총 레코드',
    en: 'Total records',
    'zh-Hans': '记录总数',
  } satisfies Localized,
  // 표 footer 의 동명 문구와 같은 규약 — 한 페이지만 센 수에 모수를 밝힌다.
  scopePage: { default: '(이 페이지)', en: '(this page)', 'zh-Hans': '(本页)' } satisfies Localized,
  distributionPageScope: {
    default: '분포는 이 페이지 기준입니다.',
    en: 'Distributions cover this page only.',
    'zh-Hans': '分布仅基于本页。',
  } satisfies Localized,
}

export function dashboardViewCopy(locale: CollectionLocale) {
  return {
    noRecords: pickLocalized(M.noRecords, locale),
    totalRecords: pickLocalized(M.totalRecords, locale),
    scopePage: pickLocalized(M.scopePage, locale),
    distributionPageScope: pickLocalized(M.distributionPageScope, locale),
  }
}
