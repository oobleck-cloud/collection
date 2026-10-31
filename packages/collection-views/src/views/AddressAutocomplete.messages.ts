import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// AddressAutocomplete(geo 셀 주소검색, #36) 문구 — co-located vocab. ko(default)는 원문 바이트 동일(파리티).
const M = {
  searchPlaceholder: {
    default: '도로명·건물명·지번 검색',
    en: 'Search road, building, or lot number',
    'zh-Hans': '搜索道路名、建筑名或地号',
  } satisfies Localized,
  searchAria: {
    default: '주소 검색',
    en: 'Search address',
    'zh-Hans': '搜索地址',
  } satisfies Localized,
  loading: {
    default: '검색 중…',
    en: 'Searching…',
    'zh-Hans': '搜索中…',
  } satisfies Localized,
  unconfigured: {
    default: '주소 검색이 설정되지 않았어요 (KAKAO_REST_API_KEY). 좌표를 직접 입력할 수 있어요.',
    en: 'Address search isn’t configured (KAKAO_REST_API_KEY). You can enter coordinates directly.',
    'zh-Hans': '地址搜索未配置 (KAKAO_REST_API_KEY)。你可以直接输入坐标。',
  } satisfies Localized,
  searchFailed: {
    default: '검색에 실패했어요. 잠시 후 다시 시도하세요.',
    en: 'Search failed. Please try again shortly.',
    'zh-Hans': '搜索失败，请稍后再试。',
  } satisfies Localized,
  noResults: {
    default: '검색 결과가 없어요.',
    en: 'No results found.',
    'zh-Hans': '没有搜索结果。',
  } satisfies Localized,
  candidatesAria: {
    default: '주소 후보',
    en: 'Address suggestions',
    'zh-Hans': '地址候选',
  } satisfies Localized,
}

export function addressAutocompleteCopy(locale: CollectionLocale) {
  return {
    searchPlaceholder: pickLocalized(M.searchPlaceholder, locale),
    searchAria: pickLocalized(M.searchAria, locale),
    loading: pickLocalized(M.loading, locale),
    unconfigured: pickLocalized(M.unconfigured, locale),
    searchFailed: pickLocalized(M.searchFailed, locale),
    noResults: pickLocalized(M.noResults, locale),
    candidatesAria: pickLocalized(M.candidatesAria, locale),
  }
}
