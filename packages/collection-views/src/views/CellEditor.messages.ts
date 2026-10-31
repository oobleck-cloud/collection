import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// CellEditor / GeoCellEditor / DateCellEditor 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티),
// en·zh-Hans 는 관용 번역.
const M = {
  empty: {
    default: '비어 있음',
    en: 'Empty',
    'zh-Hans': '为空',
  } satisfies Localized,
  locationEdit: {
    default: '위치 편집',
    en: 'Edit location',
    'zh-Hans': '编辑位置',
  } satisfies Localized,
  noLocation: {
    default: '위치 없음',
    en: 'No location',
    'zh-Hans': '无位置',
  } satisfies Localized,
  roadAddress: {
    default: '도로명주소',
    en: 'Street address',
    'zh-Hans': '街道地址',
  } satisfies Localized,
  roadAddressSearch: {
    default: '도로명·건물명 검색',
    en: 'Search address or building',
    'zh-Hans': '搜索道路名或建筑名',
  } satisfies Localized,
  // 패널 헤더 — 검색 단계/확정 단계에서 각각 무엇을 하는 곳인지 명시.
  addressSearchHeader: {
    default: '주소 검색',
    en: 'Search address',
    'zh-Hans': '搜索地址',
  } satisfies Localized,
  addressHeader: {
    default: '주소',
    en: 'Address',
    'zh-Hans': '地址',
  } satisfies Localized,
  // 검색 단계 힌트 — 무엇으로 검색하는지 안내.
  searchHint: {
    default: '도로명·건물명·지번으로 검색하세요',
    en: 'Search by road, building, or lot number',
    'zh-Hans': '按道路名、建筑名或地号搜索',
  } satisfies Localized,
  // 확정 카드 — 지번 보조 라벨 접두사와 "다시 검색" 링크.
  jibunPrefix: {
    default: '지번',
    en: 'Lot',
    'zh-Hans': '地号',
  } satisfies Localized,
  changeAddress: {
    default: '변경',
    en: 'Change',
    'zh-Hans': '更改',
  } satisfies Localized,
  // 검색 대신 입력한 텍스트를 그대로 주소로 확정(지오코딩 미설정·무결과 대비 탈출구).
  useTypedAddress: {
    default: '입력한 주소로 계속',
    en: 'Use the typed address',
    'zh-Hans': '使用输入的地址',
  } satisfies Localized,
  detailAddressPlaceholder: {
    default: '상세주소 (예: 3층 302호)',
    en: 'Address detail (e.g. Suite 302)',
    'zh-Hans': '详细地址（例：3楼302室）',
  } satisfies Localized,
  detailAddressLabel: {
    default: '상세주소',
    en: 'Address detail',
    'zh-Hans': '详细地址',
  } satisfies Localized,
  longitudePlaceholder: {
    default: '경도(x)',
    en: 'Longitude (x)',
    'zh-Hans': '经度（x）',
  } satisfies Localized,
  longitudeLabel: {
    default: '경도',
    en: 'Longitude',
    'zh-Hans': '经度',
  } satisfies Localized,
  latitudePlaceholder: {
    default: '위도(y)',
    en: 'Latitude (y)',
    'zh-Hans': '纬度（y）',
  } satisfies Localized,
  latitudeLabel: {
    default: '위도',
    en: 'Latitude',
    'zh-Hans': '纬度',
  } satisfies Localized,
  coordHint: {
    default: '경도·위도를 함께 입력하세요',
    en: 'Enter both longitude and latitude',
    'zh-Hans': '请同时输入经度和纬度',
  } satisfies Localized,
  coordSystem: {
    default: '좌표계',
    en: 'Coordinate system',
    'zh-Hans': '坐标系',
  } satisfies Localized,
  enterCoordinates: {
    default: '좌표 직접 입력 (고급)',
    en: 'Enter coordinates (advanced)',
    'zh-Hans': '手动输入坐标（高级）',
  } satisfies Localized,
  editCoordinates: {
    default: '좌표 수정',
    en: 'Edit coordinates',
    'zh-Hans': '修改坐标',
  } satisfies Localized,
  dateEdit: {
    default: '날짜 편집',
    en: 'Edit date',
    'zh-Hans': '编辑日期',
  } satisfies Localized,
  noDate: {
    default: '날짜 없음',
    en: 'No date',
    'zh-Hans': '无日期',
  } satisfies Localized,
}

export function cellEditorCopy(locale: CollectionLocale) {
  return {
    empty: pickLocalized(M.empty, locale),
    locationEdit: pickLocalized(M.locationEdit, locale),
    noLocation: pickLocalized(M.noLocation, locale),
    roadAddress: pickLocalized(M.roadAddress, locale),
    roadAddressSearch: pickLocalized(M.roadAddressSearch, locale),
    addressSearchHeader: pickLocalized(M.addressSearchHeader, locale),
    addressHeader: pickLocalized(M.addressHeader, locale),
    searchHint: pickLocalized(M.searchHint, locale),
    jibunPrefix: pickLocalized(M.jibunPrefix, locale),
    changeAddress: pickLocalized(M.changeAddress, locale),
    useTypedAddress: pickLocalized(M.useTypedAddress, locale),
    detailAddressPlaceholder: pickLocalized(M.detailAddressPlaceholder, locale),
    detailAddressLabel: pickLocalized(M.detailAddressLabel, locale),
    longitudePlaceholder: pickLocalized(M.longitudePlaceholder, locale),
    longitudeLabel: pickLocalized(M.longitudeLabel, locale),
    latitudePlaceholder: pickLocalized(M.latitudePlaceholder, locale),
    latitudeLabel: pickLocalized(M.latitudeLabel, locale),
    coordHint: pickLocalized(M.coordHint, locale),
    coordSystem: pickLocalized(M.coordSystem, locale),
    enterCoordinates: pickLocalized(M.enterCoordinates, locale),
    editCoordinates: pickLocalized(M.editCoordinates, locale),
    dateEdit: pickLocalized(M.dateEdit, locale),
    noDate: pickLocalized(M.noDate, locale),
  }
}
