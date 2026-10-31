// @oobleck/collection — 캘린더 월 그리드 순수 계산(#34).
//
// CalendarView 에서 분리한 순수 모듈(React·DOM·@oobleck/systheme 비의존) — 단위 테스트 용이.
//
// ★ 타임존 일관성(BL9/N2): date-only 값('YYYY-MM-DD')은 Date.parse 가 **UTC 자정**으로 파싱된다.
//   따라서 그리드의 날짜 셀 키·일자 귀속도 **UTC 메서드**(Date.UTC/getUTC*)로 맞춘다. 로컬 메서드를
//   쓰면 음수 UTC offset 지역에서 레코드가 하루 어긋난 셀에 붙고(1/1 → 12/31 셀), 서버(UTC)·
//   클라이언트(로컬) 그리드가 달라져 hydration 불일치가 난다. UTC 고정으로 결정성 확보.
//
// 순수성: wall-clock(zero-arg new Date()/Date.now()) 호출 없음 — year/month0/ISO 값만 받는다.
//   현재 달 선택(new Date())은 .tsx 의 책임이고, 이 모듈은 결정적 계산만 한다.

import { dateValueStart } from '@oobleck/collection'

// ─── 주 시작 요일 규약 ─────────────────────────────────────────────────────────
//
// 한국 달력 관습을 따라 **일요일 시작(Sun→Sat)** 으로 고정한다 — 헤더 순서는 일·월·화·수·목·금·토.
// (ISO 월요일 시작이 아니라, 데스크톱/모바일 한국 달력의 기본 배치를 따른 것.)
const DAYS_PER_WEEK = 7

/** 한 날짜 셀. date 는 UTC yyyy-mm-dd 키, inMonth 는 대상 월 소속 여부(앞/뒤 채움일은 false). */
export type GridDay = { date: string; inMonth: boolean }

/** 월 그리드 — 주 단위로 꽉 채운 날짜 셀 목록(앞뒤 인접월 채움 포함). */
export type MonthGrid = { days: GridDay[] }

/** UTC Date → yyyy-mm-dd 키(결정적, TZ 무관). 그리드 셀 키·레코드 귀속의 단일 규칙. */
function toDayKey(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * ISO date 값('YYYY-MM-DD' 또는 datetime) → 그 날의 yyyy-mm-dd 일자 키(UTC). 파싱 실패·빈값이면 null.
 * 레코드의 날짜 속성값을 어느 셀에 귀속시킬지 결정하는 데 쓴다. date-only 값은 UTC 자정으로 파싱되므로
 * UTC 필드로 키를 만들어야 셀 귀속이 TZ 와 무관하게 일관된다(BL9).
 */
export function isoToDayKey(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  // 기간/시간 값도 처리: 시작 성분의 날짜 부분(YYYY-MM-DD)만 UTC 자정으로 파싱 → 시작 일자 셀에 귀속.
  const dayPart = dateValueStart(value).slice(0, 10)
  const t = Date.parse(dayPart)
  if (Number.isNaN(t)) return null
  return toDayKey(new Date(t))
}

/**
 * (year, month0) 월의 달력 그리드를 만든다(순수, UTC). month0 은 0-based(0=1월, 11=12월).
 *  - 첫 셀: 대상 월 1일이 속한 주의 일요일(앞쪽 인접월 일자로 채움, inMonth=false).
 *  - 마지막 셀: 마지막 주의 토요일까지(뒤쪽 인접월 일자로 채움, inMonth=false).
 *  - 항상 주 단위(7의 배수) 길이 — 달에 따라 4·5·6주.
 *
 * UTC 메서드만 사용 — 음수 offset TZ 에서도 일자 경계가 어긋나지 않는다(BL9 회귀 클래스).
 */
export function buildMonthGrid(year: number, month0: number): MonthGrid {
  // 대상 월 1일(UTC). Date.UTC 는 month overflow 를 정규화하므로 month0 범위 밖이어도 안전.
  const first = new Date(Date.UTC(year, month0, 1))
  // 대상 월의 정규화된 연/월(overflow 입력 대비) — inMonth·종료 판정 기준.
  const targetYear = first.getUTCFullYear()
  const targetMonth = first.getUTCMonth()
  // 대상 월 마지막 날(UTC): 다음 달 0일 = 이번 달 말일.
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()

  // 그리드 시작: 1일이 속한 주의 일요일로 내림(getUTCDay: 0=일 … 6=토).
  const cursor = new Date(first)
  cursor.setUTCDate(cursor.getUTCDate() - first.getUTCDay())

  const days: GridDay[] = []
  // 주(7칸) 단위로 채우되, 마지막 날을 덮은 *주를 끝까지* 채운 뒤 종료(꼬리 주의 토요일까지).
  // 가드(6주=42칸 상한): 일요일 시작 그리드는 어떤 월이든 최대 6주면 충분.
  while (days.length < DAYS_PER_WEEK * 6) {
    const inMonth = cursor.getUTCFullYear() === targetYear && cursor.getUTCMonth() === targetMonth
    days.push({ date: toDayKey(cursor), inMonth })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    // 주 경계에서: 대상 월의 말일을 이미 지났으면(커서가 그 다음 날) 종료.
    if (days.length % DAYS_PER_WEEK === 0) {
      const passedMonth =
        cursor.getUTCFullYear() > targetYear ||
        (cursor.getUTCFullYear() === targetYear && cursor.getUTCMonth() > targetMonth) ||
        (cursor.getUTCFullYear() === targetYear &&
          cursor.getUTCMonth() === targetMonth &&
          cursor.getUTCDate() > lastDay)
      if (passedMonth) break
    }
  }

  return { days }
}
