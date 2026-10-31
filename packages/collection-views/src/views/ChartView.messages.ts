import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// ChartView 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const M = {
  pickGroup: {
    default: '그룹 기준을 선택하면 분포를 막대로 봅니다.',
    en: 'Select a group-by to see the distribution as bars.',
    'zh-Hans': '选择分组依据后即可以柱状图查看分布。',
  } satisfies Localized,
  // 표 footer 의 "(이 페이지)" 와 같은 규약 — 한 페이지만 센 분포에 모수를 밝힌다.
  pageScope: {
    default: '이 페이지 기준 분포입니다.',
    en: 'Distribution covers this page only.',
    'zh-Hans': '此分布仅基于本页。',
  } satisfies Localized,
}

export function chartViewCopy(locale: CollectionLocale) {
  return {
    pickGroup: pickLocalized(M.pickGroup, locale),
    pageScope: pickLocalized(M.pageScope, locale),
  }
}
