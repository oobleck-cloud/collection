// @oobleck/collection — resolveMapboxToken 실 env 접근 테스트(#36).
//
// 목적: 토큰 해석이 실제 process.env 를 읽는 경로를 모킹 없이 고정하는 회귀 핀.
//   MapView.test.tsx 는 resolveMapboxToken 자체를 모킹하므로 env 접근 경로가 검증되지 않는다
//   (동적 키 접근 버그가 초록 테스트 뒤에 숨었던 사고를 차단). 여기서는 절대 모킹하지 않고,
//   리터럴 process.env.NEXT_PUBLIC_MAPBOX_TOKEN 을 직접 세팅/해제해 실제 반환값을 검증한다.
//
// 순수 모듈(React·DOM 비의존) → node 환경.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAPBOX_TOKEN_ENV, resolveMapboxToken } from './mapbox-token'

// 테스트 간 env 오염 방지 — 원래 값 보존 후 복원.
let original: string | undefined

beforeEach(() => {
  original = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN
})

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  else process.env.NEXT_PUBLIC_MAPBOX_TOKEN = original
})

describe('resolveMapboxToken — 실 env 접근(모킹 없음)', () => {
  it('상수 이름이 리터럴 env 키와 일치한다(안내 메시지 ↔ READ 경로 동기화)', () => {
    expect(MAPBOX_TOKEN_ENV).toBe('NEXT_PUBLIC_MAPBOX_TOKEN')
  })

  it('env 설정 시 그 값을 반환한다', () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.real-token'
    expect(resolveMapboxToken()).toBe('pk.real-token')
  })

  it('env 미설정(undefined)이면 빈 문자열을 반환한다', () => {
    // beforeEach 에서 이미 delete 됨.
    expect(process.env.NEXT_PUBLIC_MAPBOX_TOKEN).toBeUndefined()
    expect(resolveMapboxToken()).toBe('')
  })

  it('env 가 공백/빈 문자열이면 트림 후 빈 문자열을 반환한다(깨진 지도 금지 게이트)', () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = ''
    expect(resolveMapboxToken()).toBe('')

    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = '   '
    expect(resolveMapboxToken()).toBe('')
  })

  it('값 앞뒤 공백은 트림한다(.env 복붙 오염 방지)', () => {
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = '  pk.padded  '
    expect(resolveMapboxToken()).toBe('pk.padded')
  })
})
