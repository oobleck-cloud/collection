// 지오코딩(주소 검색) — 도메인 무관 계약(프로바이더 seam). geo 셀(GeoValue)의 검색 표면 계약이라
// collections(L1)에 산다 — 구현(lib/infra/geocode: Kakao fetch·REST key)은 app-side 어댑터.
//
// "자연어 질의 → 좌표 있는 주소 후보"를 프로바이더(Kakao·Google…)로부터 얻는 최소 계약이다.
// 프로바이더 교체는 lib/infra/geocode/index.ts 한 곳에서 이뤄지고, 라우트·UI 는 이 타입만 안다.
// 런타임 코드는 서버 전용 — 클라이언트(AddressAutocomplete)는 이 파일의 *타입만* import 한다.

/** 지오코딩 결과 좌표계 — 현재 프로바이더(Kakao)는 WGS84(GPS) 경위도만 반환한다(Google 도 동일). */
export type GeoCoordinateSystem = 'WGS84'

/**
 * 주소 검색 결과 1건 — 자동완성 목록의 한 항목. 셀 저장 시 GeoValue 로 변환한다.
 *  - placeName: 장소/건물명(POI). 목록 제목. 순수 주소 결과는 빈 문자열일 수 있다.
 *  - roadAddress: 도로명주소 — 저장 라벨 1순위. 없으면 빈 문자열(지번/장소명으로 폴백).
 *  - jibunAddress: 지번주소 — 도로명 부재 시 폴백·보조 표시.
 *  - x / y: 경도(lng) / 위도(lat). coordinateSystem 좌표계 기준.
 */
export type GeoSearchResult = {
  /** 안정 식별자(프로바이더 결과 id) — React key·중복 제거용. */
  id: string
  placeName: string
  roadAddress: string
  jibunAddress: string
  x: number
  y: number
  coordinateSystem: GeoCoordinateSystem
}

/**
 * 지오코딩 프로바이더 계약 — search(query) 하나. 도메인 무관.
 * 새 프로바이더(Google 등)는 이 인터페이스만 구현하면 라우트·UI 변경 없이 꽂힌다("나중엔 구글로").
 */
export type GeocodeProvider = {
  /** 안정 프로바이더 키(로그·에러 메시지용). */
  readonly name: string
  /**
   * 자유 텍스트 질의 → 결과 목록. 빈/공백 질의는 빈 배열.
   * 네트워크·프로바이더 오류는 throw(라우트가 502 로 흡수) — 여기서 삼키지 않는다.
   */
  search: (query: string) => Promise<GeoSearchResult[]>
}
