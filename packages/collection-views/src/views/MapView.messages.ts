import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// MapView 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const M = {
  addGeo: {
    default: '위치(geo) 속성을 추가하면 지도에 표시됩니다.',
    en: 'Add a location (geo) property to show items on the map.',
    'zh-Hans': '添加位置(geo)属性后即可在地图上显示。',
  } satisfies Localized,
  needToken: {
    default: '지도를 표시하려면 Mapbox 토큰(NEXT_PUBLIC_MAPBOX_TOKEN) 설정이 필요합니다.',
    en: 'A Mapbox token (NEXT_PUBLIC_MAPBOX_TOKEN) is required to show the map.',
    'zh-Hans': '要显示地图，需要配置 Mapbox 令牌(NEXT_PUBLIC_MAPBOX_TOKEN)。',
  } satisfies Localized,
  noData: {
    default: '표시할 위치 데이터가 없습니다. 레코드에 좌표를 입력하세요.',
    en: 'No location data to show. Add coordinates to your records.',
    'zh-Hans': '没有可显示的位置数据。请在记录中输入坐标。',
  } satisfies Localized,
  mapAria: {
    default: '컬렉션 위치 지도',
    en: 'Collection location map',
    'zh-Hans': '集合位置地图',
  } satisfies Localized,
}

export function mapViewCopy(locale: CollectionLocale) {
  return {
    addGeo: pickLocalized(M.addGeo, locale),
    needToken: pickLocalized(M.needToken, locale),
    noData: pickLocalized(M.noData, locale),
    mapAria: pickLocalized(M.mapAria, locale),
  }
}
