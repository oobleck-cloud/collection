// @oobleck/collection — Mapbox 토큰 해석(#36).
//
// MapView 가 깨진 빈 지도를 그리지 않도록 토큰 유무를 판정한다. 토큰은 클라이언트에서 읽히므로
// NEXT_PUBLIC_ 접두사(런타임 노출). 별도 모듈로 분리해 MapView 테스트에서 손쉽게 모킹한다.
//
// 중요: Next.js 는 `process.env.NEXT_PUBLIC_*` 의 "리터럴 멤버 접근"만 빌드타임에 webpack
// DefinePlugin 텍스트 치환으로 인라인한다. `process.env[변수]` 같은 동적 키는 절대 치환되지 않아
// 클라이언트 번들에서 항상 undefined 가 된다(MapView 는 'use client'). 따라서 토큰 READ 는 반드시
// 리터럴 process.env.NEXT_PUBLIC_MAPBOX_TOKEN 으로 한다 — MAPBOX_TOKEN_ENV 상수는 사용자 안내
// 메시지 표기에만 쓰고, env 를 READ 하는 데에는 절대 쓰지 않는다.

/** 환경변수 이름(사용자 안내 메시지 표기용) — .env.example 과 일치해야 한다. env READ 에 쓰지 말 것. */
export const MAPBOX_TOKEN_ENV = 'NEXT_PUBLIC_MAPBOX_TOKEN'

/**
 * Mapbox access token 을 환경에서 읽는다. 미설정(빈/공백/undefined)이면 빈 문자열을 반환 —
 * 호출자(MapView)가 빈 문자열을 "토큰 없음"으로 분기해 안내 상태를 보인다(깨진 지도 금지).
 *
 * 리터럴 멤버 접근(process.env.NEXT_PUBLIC_MAPBOX_TOKEN)을 유지해야 Next.js 가 클라이언트
 * 번들에 값을 인라인한다 — 동적 키 접근은 브라우저에서 항상 undefined 가 되므로 금지.
 */
export function resolveMapboxToken(): string {
  return (process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '').trim()
}
