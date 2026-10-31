// date 프로퍼티 값 표현(노션식 확장). 하위호환: 기존 'YYYY-MM-DD' 는 그대로 유효하다.
//   · 'YYYY-MM-DD'                     — 단일 일자
//   · 'YYYY-MM-DDTHH:mm'               — 시간 포함(datetime)
//   · '<start>/<end>'                  — 기간(종료일). start·end 각각 위 두 형태 중 하나(같은 hasTime).
// 항상 *시작이 앞*. 캘린더/정렬/필터/투영 등 값을 읽는 모든 곳은 dateValueStart 로 시작 성분을 뽑아 쓴다
// (기간·시간 값에서도 깨지지 않게). SQL 투영(dateVal)은 시작 타임스탬프만 저장 → 정렬/필터/집계는 "시작 기준".

import type { DateDisplayFormat } from './types'

/** 시작 성분('/' 앞). 기간이 아니면 값 그대로. */
export function dateValueStart(v: string): string {
  const i = v.indexOf('/')
  return i === -1 ? v : v.slice(0, i)
}

/** 종료 성분('/' 뒤) 또는 null(기간 아님). */
export function dateValueEnd(v: string): string | null {
  const i = v.indexOf('/')
  return i === -1 ? null : v.slice(i + 1)
}

/** 시간 포함 여부(시작 성분에 'T' 존재). */
export function dateValueHasTime(v: string): boolean {
  return dateValueStart(v).includes('T')
}

/** 시작 시각 epoch ms(정렬·비교용). 파싱 실패면 null. */
export function dateValueStartMs(v: string): number | null {
  const t = Date.parse(dateValueStart(v))
  return Number.isNaN(t) ? null : t
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/

/**
 * date 성분('YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm')으로 유효한가 — 형태 + **달력 실재성**.
 * `2026-02-30`·`2026-13-01`·`2026-01-01T25:00` 처럼 형태만 맞고 존재하지 않는 값은 거부한다
 * (Date 생성자가 조용히 넘겨버리는 롤오버를 성분 재비교로 잡는다).
 */
export function isDateComponent(s: string): boolean {
  const m = DATE_RE.exec(s)
  if (!m) return false
  const [, y, mo, d, hh, mm] = m
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  const hour = hh === undefined ? 0 : Number(hh)
  const minute = mm === undefined ? 0 : Number(mm)
  if (hour > 23 || minute > 59) return false
  const dt = new Date(year, month - 1, day)
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day
}

/**
 * date 프로퍼티 값으로 유효한가 — 단일('YYYY-MM-DD')·시간('…THH:mm')·기간('<start>/<end>') 전부.
 * 기간은 양쪽 성분이 각각 유효하고 **시작 ≤ 끝**이어야 한다(항상 시작이 앞 — 이 파일 상단 규약).
 * 데이터 API 쓰기 검증(record-schema)의 단일 출처 — 표현 규약을 아는 이 파일이 판정도 소유한다.
 */
export function isDateValue(v: string): boolean {
  const end = dateValueEnd(v)
  const start = dateValueStart(v)
  if (!isDateComponent(start)) return false
  if (end === null) return true
  if (!isDateComponent(end)) return false
  const s = dateValueStartMs(start)
  const e = dateValueStartMs(end)
  return s !== null && e !== null && s <= e
}

/** ISO date/datetime 성분 → 로컬 Date(달력·표시가 로컬 날짜 메서드를 쓰므로 로컬로 앵커). 실패면 null. */
function toLocalDate(s: string): Date | null {
  const m = DATE_RE.exec(s.trim())
  if (m) {
    const [, y, mo, d, hh, mm] = m
    return new Date(Number(y), Number(mo) - 1, Number(d), hh ? Number(hh) : 0, mm ? Number(mm) : 0)
  }
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t)
}

export type DateValueParts = { start: Date | null; end: Date | null; hasTime: boolean }

/** 값 문자열 → { start, end, hasTime }(로컬 Date). 빈값/파싱불가면 start=null. */
export function parseDateValueParts(v: string | null | undefined): DateValueParts {
  const raw = (v ?? '').trim()
  if (!raw) return { start: null, end: null, hasTime: false }
  const endRaw = dateValueEnd(raw)
  return {
    start: toLocalDate(dateValueStart(raw)),
    end: endRaw ? toLocalDate(endRaw) : null,
    hasTime: dateValueHasTime(raw),
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 로컬 Date → ISO 성분('YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm'). */
function toIso(d: Date, hasTime: boolean): string {
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return hasTime ? `${base}T${pad(d.getHours())}:${pad(d.getMinutes())}` : base
}

/** { start, end?, hasTime? } → 정규 저장형 문자열. end 가 있으면 기간(시작<=종료 보장, 역전 시 교환). */
export function buildDateValue(parts: {
  start: Date
  end?: Date | null
  hasTime?: boolean
}): string {
  const hasTime = parts.hasTime ?? false
  if (parts.end) {
    const [a, b] = parts.start <= parts.end ? [parts.start, parts.end] : [parts.end, parts.start]
    return `${toIso(a, hasTime)}/${toIso(b, hasTime)}`
  }
  return toIso(parts.start, hasTime)
}

/**
 * 표시용 문자열 — 단일/시간/기간 모두. 빈값이면 ''.
 * `format` 은 컬럼의 표시 모양(PropertyDef.dateFormat): 기본 'ko' 「2026. 10. 21.」, 'iso' 「2026-10-21」,
 * 'relative' 「D-3」·「D-day」·「D+2」(오늘 = `now` 의 로컬 날짜, 시각은 무시하고 날짜 차이만 센다).
 */
export function formatDateValueDisplay(
  v: string,
  format: DateDisplayFormat = 'ko',
  now: Date = new Date(),
): string {
  const { start, end, hasTime } = parseDateValueParts(v)
  if (!start) return ''
  const one = (d: Date) => formatDay(d, hasTime, format, now)
  return end ? `${one(start)} ~ ${one(end)}` : one(start)
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 오늘 기준 날짜 거리 — 「D-3」(3일 남음) · 「D-day」(오늘) · 「D+2」(2일 지남). 시각은 보지 않는다.
 * 일광절약 전환이 있는 날도 하루가 23·25시간이라 반올림으로 하루 단위를 맞춘다.
 */
export function formatRelativeDay(d: Date, now: Date = new Date()): string {
  const diff = dayDistance(d, now)
  if (diff === 0) return 'D-day'
  return diff > 0 ? `D-${diff}` : `D+${-diff}`
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 「10/23(목)」 — 올해가 아니면 연도를 앞에 붙인다(「2025/10/23(목)」). */
export function formatShortDay(d: Date, now: Date = new Date()): string {
  const md = `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_KO[d.getDay()]})`
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}/${md}`
}

/** 오늘 기준 날짜 거리(일) — 내일 1 · 오늘 0 · 어제 -1. 시각은 보지 않는다. */
export function dayDistance(d: Date, now: Date = new Date()): number {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((day - today) / DAY_MS)
}

function formatDay(d: Date, hasTime: boolean, format: DateDisplayFormat, now: Date): string {
  const day =
    format === 'relative'
      ? formatRelativeDay(d, now)
      : format === 'iso'
        ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        : format === 'short'
          ? formatShortDay(d, now)
          : d.toLocaleDateString('ko-KR')
  return hasTime ? `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}` : day
}
