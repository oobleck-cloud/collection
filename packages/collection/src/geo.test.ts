// geo 헬퍼 단위 테스트 — 경위도 매핑·표시 라벨·타입가드(#45).

import { describe, it, expect } from 'vitest'
import { geoToLngLat, formatGeoLabel, formatTitleText, hasGeoCoordinate, isGeoValue } from './geo'
import type { GeoValue } from './types'

const seoul: GeoValue = {
  coordinate: { x: 126.978, y: 37.5665, type: 'WGS84' },
  roadAddress: '서울특별시 중구 세종대로 110',
}

describe('geoToLngLat', () => {
  it('x→lng, y→lat 로 매핑한다(축 순서 보존)', () => {
    expect(geoToLngLat(seoul)).toEqual({ lng: 126.978, lat: 37.5665 })
  })
})

describe('formatGeoLabel', () => {
  it('roadAddress 가 있으면 그것을 라벨로', () => {
    expect(formatGeoLabel(seoul)).toBe('서울특별시 중구 세종대로 110')
  })

  it('detailAddress 가 있으면 도로명주소 뒤에 이어 붙인다', () => {
    expect(formatGeoLabel({ ...seoul, detailAddress: '3층' })).toBe(
      '서울특별시 중구 세종대로 110 3층',
    )
  })

  it('roadAddress 가 비면 "위도, 경도"(y, x) 좌표로 폴백', () => {
    const noAddr: GeoValue = { coordinate: { x: 127, y: 37.5, type: 'WGS84' }, roadAddress: '' }
    expect(formatGeoLabel(noAddr)).toBe('37.5, 127')
  })

  it('공백뿐인 roadAddress 도 비어있음으로 보고 좌표 폴백', () => {
    const blank: GeoValue = { coordinate: { x: 127, y: 37.5, type: 'WGS84' }, roadAddress: '   ' }
    expect(formatGeoLabel(blank)).toBe('37.5, 127')
  })

  it('좌표 폴백은 6자리로 반올림한다(끝자리 0 다듬음)', () => {
    const noisy: GeoValue = {
      coordinate: { x: 126.97812345678, y: 37.56651234567, type: 'WGS84' },
      roadAddress: '',
    }
    expect(formatGeoLabel(noisy)).toBe('37.566512, 126.978123')
  })
})

describe('isGeoValue', () => {
  it('유효한 GeoValue → true', () => {
    expect(isGeoValue(seoul)).toBe(true)
  })

  it('비객체·null·문자열·배열 → false', () => {
    expect(isGeoValue(null)).toBe(false)
    expect(isGeoValue('서울')).toBe(false)
    expect(isGeoValue(42)).toBe(false)
    expect(isGeoValue([1, 2])).toBe(false)
  })

  it('coordinate 누락/좌표 비숫자/roadAddress 비문자열 → false', () => {
    expect(isGeoValue({ roadAddress: '서울' })).toBe(false)
    expect(isGeoValue({ coordinate: { x: 'a', y: 1 }, roadAddress: '서울' })).toBe(false)
    expect(isGeoValue({ coordinate: { x: 1, y: 2, type: 'WGS84' } })).toBe(false)
  })

  it('coordinate.type 이 유효 좌표계가 아니면 → false(경계 강화)', () => {
    expect(isGeoValue({ coordinate: { x: 1, y: 2, type: 'BOGUS' }, roadAddress: '서울' })).toBe(
      false,
    )
    expect(isGeoValue({ coordinate: { x: 1, y: 2 }, roadAddress: '서울' })).toBe(false) // type 누락
    expect(isGeoValue({ coordinate: { x: 1, y: 2, type: 'TM' }, roadAddress: '서울' })).toBe(true)
  })
})

describe('hasGeoCoordinate — 실제 좌표 유무(지도 핀 #36 게이트)', () => {
  it('(0,0) sentinel(좌표 미설정, 도로명만) → false', () => {
    const roadOnly: GeoValue = {
      coordinate: { x: 0, y: 0, type: 'WGS84' },
      roadAddress: '서울 어딘가',
    }
    expect(hasGeoCoordinate(roadOnly)).toBe(false)
  })

  it('실제 좌표가 있으면 → true', () => {
    expect(hasGeoCoordinate(seoul)).toBe(true)
    // 한 축만 0 이어도 (0,0) sentinel 이 아니므로 실제 좌표로 본다.
    const onAxis: GeoValue = { coordinate: { x: 0, y: 37.5, type: 'WGS84' }, roadAddress: '' }
    expect(hasGeoCoordinate(onAxis)).toBe(true)
  })
})

describe('formatTitleText — 제목 텍스트 안전 변환(객체값 라벨화)', () => {
  it('빈값(null/undefined/빈 문자열)은 ""', () => {
    expect(formatTitleText(null)).toBe('')
    expect(formatTitleText(undefined as never)).toBe('')
    expect(formatTitleText('')).toBe('')
  })

  it('스칼라·배열은 그대로/조인', () => {
    expect(formatTitleText('제목')).toBe('제목')
    expect(formatTitleText(42)).toBe('42')
    expect(formatTitleText(['a', 'b'])).toBe('a, b')
  })

  it('GeoValue 는 도로명주소 라벨로 ("[object Object]" 누수 차단)', () => {
    expect(formatTitleText(seoul)).toBe('서울특별시 중구 세종대로 110')
  })

  it('TagValue(색 힌트 실은 값)는 tag 라벨로 (유니온 완전성 — 빈칸 폴백 방지)', () => {
    expect(formatTitleText({ tag: '구독', color: 'blue' })).toBe('구독')
    expect(formatTitleText({ tag: '오류' })).toBe('오류')
  })

  it('ButtonValue 는 label 로, 라벨 없는 객체는 "" (누수 차단)', () => {
    expect(formatTitleText({ action: 'restore', label: '복원' })).toBe('복원')
    expect(formatTitleText({ foo: 'bar' } as never)).toBe('')
  })
})
