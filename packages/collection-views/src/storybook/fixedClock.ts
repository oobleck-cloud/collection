// @mvos/collections — 스토리용 고정 시계.
//
// CalendarView 는 표시 월의 초기값을 `new Date()` 로 잡는다(그 파일에서만 허용된 wall-clock).
// 시각회귀에서 이건 치명적이다: 아무도 코드를 건드리지 않아도 달이 바뀌는 순간 격자·일자·
// 주 수가 전부 달라져 베이스라인이 깨진다. 매달 "정상인데 빨간" diff 를 승인하다 보면
// 그 다음의 *진짜* 회귀도 같이 승인된다.
//
// 그래서 프로덕션 코드에 테스트 전용 prop 을 뚫는 대신, 스토리 실행 동안만 시계를 고정한다.
// Storybook 8 의 `beforeEach` 는 정리 함수를 반환할 수 있어 스토리 밖으로 새지 않는다.

import type { Preview } from '@storybook/react'

/** 고정 시각 — 2026-03-15T00:00:00Z. 픽스처의 날짜(2026-03-xx)가 이 달 격자 안에 들어온다. */
export const FIXED_NOW = Date.UTC(2026, 2, 15)

type BeforeEach = NonNullable<Preview['beforeEach']>

/**
 * 스토리 실행 동안 `new Date()` / `Date.now()` 를 FIXED_NOW 로 고정한다.
 * 인자 있는 생성(`new Date(iso)`)은 그대로 통과 — 픽스처의 ISO 날짜 파싱은 손대지 않는다.
 *
 * 사용: `const meta = { beforeEach: withFixedNow, ... }`
 */
export const withFixedNow: BeforeEach = () => {
  const RealDate = globalThis.Date
  const realNow = RealDate.now

  class FixedDate extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) super(FIXED_NOW)
      else super(...(args as [any]))
    }
  }
  FixedDate.now = () => FIXED_NOW

  globalThis.Date = FixedDate as DateConstructor

  return () => {
    globalThis.Date = RealDate
    RealDate.now = realNow
  }
}
