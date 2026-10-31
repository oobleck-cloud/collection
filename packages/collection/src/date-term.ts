// @mvos/collections — 낱말 → 날짜(범위) 파서.
//
// 검색창에 사람이 실제로 치는 모든 날짜 표현을 받는다. 운영에서 `2026-08-13` 이라고 치지
// 않는다 — `오늘`, `이번 주`, `8월 13일`, `0831`, `D-7` 이라고 친다. 그 어휘를 못 읽으면
// 자동완성은 날짜 컬럼에 대해 아무 말도 못 하고, 사용자는 날짜로 거를 수 없다고 결론짓는다.
//
// **`now` 는 반드시 주입받는다.** 상대 표현(`오늘`·`이번 주`)은 오늘이 언제냐에 따라 답이
// 달라지므로, 내부에서 `new Date()` 를 부르면 테스트가 날짜를 넘길 때마다 깨지고 그 실패는
// 코드가 아니라 달력 탓이라 원인을 찾기 어렵다.
//
// **주의 시작은 월요일**(ISO). 방문 일정이 주 단위로 도는 업무라 "이번 주" 는 월~일이다.

/** 낱말이 가리키는 범위의 크기. `8월` 은 한 달, `8월 13일` 은 하루. */
export type DatePrecision = 'day' | 'week' | 'month' | 'year'

export type ParsedDateTerm = {
  precision: DatePrecision
  /** 범위 시작(포함) `YYYY-MM-DD`. */
  start: string
  /** 범위 끝(포함) `YYYY-MM-DD`. */
  end: string
  /** 사람이 읽는 표기 — 드롭다운 라벨. */
  label: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`
/** 그 달의 마지막 날 — 윤년 포함(0일 = 전달의 마지막). */
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate()

const isoOf = (d: Date) => iso(d.getFullYear(), d.getMonth() + 1, d.getDate())
/** 로컬 자정 기준의 날짜 복제 — 시:분이 섞이면 addDays 가 서머타임 경계에서 흔들린다. */
const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => {
  const c = atMidnight(d)
  c.setDate(c.getDate() + n)
  return c
}

function dayOf(d: Date, label: string): ParsedDateTerm {
  const s = isoOf(d)
  return { precision: 'day', start: s, end: s, label }
}

function dayTerm(y: number, m: number, d: number): ParsedDateTerm | null {
  if (m < 1 || m > 12 || d < 1 || d > lastDay(y, m)) return null
  return { precision: 'day', start: iso(y, m, d), end: iso(y, m, d), label: `${y}년 ${m}월 ${d}일` }
}

function monthTerm(y: number, m: number, label?: string): ParsedDateTerm | null {
  if (m < 1 || m > 12) return null
  return {
    precision: 'month',
    start: iso(y, m, 1),
    end: iso(y, m, lastDay(y, m)),
    label: label ?? `${y}년 ${m}월`,
  }
}

function yearTerm(y: number, label?: string): ParsedDateTerm {
  return {
    precision: 'year',
    start: iso(y, 1, 1),
    end: iso(y, 12, 31),
    label: label ?? `${y}년`,
  }
}

/** 그 주의 월요일. `getDay()` 는 일=0 이라 월요일까지의 거리를 따로 센다. */
function mondayOf(d: Date): Date {
  const day = d.getDay()
  return addDays(d, day === 0 ? -6 : 1 - day)
}

function weekTerm(anchor: Date, label: string): ParsedDateTerm {
  const mon = mondayOf(anchor)
  return { precision: 'week', start: isoOf(mon), end: isoOf(addDays(mon, 6)), label }
}

// ─── 어휘 ────────────────────────────────────────────────────────────────────

/** 하루를 가리키는 말 → 오늘로부터의 오프셋. */
const DAY_WORDS: Record<string, number> = {
  오늘: 0,
  금일: 0,
  내일: 1,
  명일: 1,
  낼: 1,
  모레: 2,
  내일모레: 2,
  글피: 3,
  어제: -1,
  작일: -1,
  어저께: -1,
  그저께: -2,
  그제: -2,
}

/** 주를 가리키는 말 → 주 오프셋. */
const WEEK_WORDS: Record<string, number> = {
  이번주: 0,
  금주: 0,
  이번週: 0,
  다음주: 1,
  담주: 1,
  차주: 1,
  내주: 1,
  지난주: -1,
  저번주: -1,
  전주: -1,
}

/** 달을 가리키는 말 → 월 오프셋. */
const MONTH_WORDS: Record<string, number> = {
  이번달: 0,
  이달: 0,
  금월: 0,
  당월: 0,
  다음달: 1,
  담달: 1,
  익월: 1,
  내달: 1,
  지난달: -1,
  저번달: -1,
  전월: -1,
}

/** 해를 가리키는 말 → 연 오프셋. */
const YEAR_WORDS: Record<string, number> = {
  올해: 0,
  금년: 0,
  내년: 1,
  명년: 1,
  작년: -1,
  지난해: -1,
  재작년: -2,
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** `일`·`주` → 일수. `개월`·`달` 은 길이가 달마다 달라 별도 처리한다. */
const UNIT_DAYS: Record<string, number> = { 일: 1, 주: 7, 주일: 7 }

/** 한글 수사 — "두 주 전" 처럼 아라비아 숫자를 안 쓰는 입력도 받는다. */
const KO_NUM: Record<string, number> = {
  한: 1,
  두: 2,
  세: 3,
  네: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덟: 8,
  아홉: 9,
  열: 10,
}

const koNum = (s: string): number => KO_NUM[s] ?? Number(s)

// ─── 파서 ────────────────────────────────────────────────────────────────────

/**
 * 낱말 → 날짜(범위). 못 읽으면 `null`.
 *
 * 완성형 검사가 아니다: `8월` 도 `2026` 도 읽힌다(각각 한 달·한 해). 다만 **아직 날짜로
 * 해석되지 않는 조각**(`2026-0`)은 값을 지어낼 수 없으므로 null 이다 — 접두를 받되 없는
 * 날짜를 만들어내지는 않는다. 한 글자 더 치면(`2026-09`) 바로 읽힌다.
 */
export function parseDateTerm(term: string, now: Date = new Date()): ParsedDateTerm | null {
  const raw = term.trim()
  if (raw === '') return null
  const t = raw.replace(/\s+/g, ' ')
  // 띄어쓰기는 사람마다 다르다("이번 주"·"이번주") — 어휘 조회는 공백을 없앤 형태로 한다.
  const compact = t.replace(/\s/g, '')
  const thisYear = now.getFullYear()
  const num = (s: string | undefined) => Number(s)

  // ── 상대 표현 ──
  const dayOffset = DAY_WORDS[compact]
  if (dayOffset !== undefined) return dayOf(addDays(now, dayOffset), t)

  const weekOffset = WEEK_WORDS[compact]
  if (weekOffset !== undefined) return weekTerm(addDays(now, weekOffset * 7), t)

  const monthOffset = MONTH_WORDS[compact]
  if (monthOffset !== undefined) {
    const d = new Date(thisYear, now.getMonth() + monthOffset, 1)
    return monthTerm(d.getFullYear(), d.getMonth() + 1, t)
  }

  const yearOffset = YEAR_WORDS[compact]
  if (yearOffset !== undefined) return yearTerm(thisYear + yearOffset, t)

  // `이번주 금요일` / `다음주 월` / `금요일`
  let m =
    /^(이번주|금주|다음주|담주|차주|내주|지난주|저번주|전주)?([일월화수목금토])(?:요일)?$/.exec(
      compact,
    )
  if (m) {
    const wk = m[1] ? (WEEK_WORDS[m[1]] ?? 0) : 0
    const target = WEEKDAYS.indexOf(m[2] as string)
    const mon = mondayOf(addDays(now, wk * 7))
    // 월요일 기준 거리 — 일요일은 그 주의 마지막(6)이다.
    const fromMon = target === 0 ? 6 : target - 1
    return dayOf(addDays(mon, fromMon), `${m[1] ?? '이번주'} ${WEEKDAYS[target]}요일`)
  }

  // `일주일 전` — "일주일" 은 수사 없이 한 주를 뜻하는 한 낱말이라 따로 받는다.
  m = /^(일주일|한주)(전|뒤|후)$/.exec(compact)
  if (m) return dayOf(addDays(now, 7 * (m[2] === '전' ? -1 : 1)), t)

  // `3일 전` / `2주 후` / `두 주 전` — 수사는 아라비아·한글 둘 다.
  m = /^(\d+|[한두세네]|다섯|여섯|일곱|여덟|아홉|열)(일|주일|주)(전|뒤|후)$/.exec(compact)
  if (m) {
    const n = koNum(m[1] as string) * (UNIT_DAYS[m[2] as string] ?? 1)
    const sign = m[3] === '전' ? -1 : 1
    return dayOf(addDays(now, n * sign), t)
  }
  m = /^(\d+|[한두세네]|다섯|여섯|일곱|여덟|아홉|열)(개월|달)(전|뒤|후)$/.exec(compact)
  if (m) {
    const sign = m[3] === '전' ? -1 : 1
    const d = new Date(thisYear, now.getMonth() + koNum(m[1] as string) * sign, 1)
    return monthTerm(d.getFullYear(), d.getMonth() + 1, t)
  }

  // `D-7` / `D+3` — 미소 내부에서 쓰는 표기.
  m = /^[dD]\s*([+-])\s*(\d+)$/.exec(compact)
  if (m) return dayOf(addDays(now, num(m[2]) * (m[1] === '-' ? -1 : 1)), `D${m[1]}${m[2]}`)

  // ── 절대 표현 ──

  // 한국어 — `2026년 8월 13일` / `8월 13일` / `8월13일` / `8월`
  m = /^(?:(\d{4})년)?(\d{1,2})월(?:(\d{1,2})일?)?$/.exec(compact)
  if (m) {
    const y = m[1] ? num(m[1]) : thisYear
    return m[3] ? dayTerm(y, num(m[2]), num(m[3])) : monthTerm(y, num(m[2]))
  }

  // `2026년`
  m = /^(\d{4})년$/.exec(compact)
  if (m) return yearTerm(num(m[1]))

  // 구분자형 — `2026-08-13` / `2026.8.13` / `2026/08/13`
  m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(t)
  if (m) return dayTerm(num(m[1]), num(m[2]), num(m[3]))

  // `2026-08` / `2026.8`
  m = /^(\d{4})[-./](\d{1,2})$/.exec(t)
  if (m) return monthTerm(num(m[1]), num(m[2]))

  // 연도 생략 — `8-13` / `8/13` / `8.13`
  m = /^(\d{1,2})[-./](\d{1,2})$/.exec(t)
  if (m) return dayTerm(thisYear, num(m[1]), num(m[2]))

  // 붙여 쓴 형태 — `20260813`
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(t)
  if (m) return dayTerm(num(m[1]), num(m[2]), num(m[3]))

  // **`0831` — MMDD 압축.** 선행 0 이 있으면 일련번호가 아니라 날짜다(주문번호는 0 으로
  // 시작하지 않는다). `0831` 은 8월 31일. 선행 0 이 없는 `831` 도 8월 31일로 읽되,
  // 네 자리 `1231` 같은 건 연도(1231년)로 읽히지 않게 아래 연도 규칙이 범위를 좁힌다.
  m = /^(\d{2})(\d{2})$/.exec(t)
  if (m && t.startsWith('0')) return dayTerm(thisYear, num(m[1]), num(m[2]))
  m = /^(\d)(\d{2})$/.exec(t)
  if (m) return dayTerm(thisYear, num(m[1]), num(m[2]))

  // `2026` — 한 해. 그럴듯한 연도만(1900~2199) — 네 자리 일련번호가 전부 연도로 읽히지 않게.
  m = /^(\d{4})$/.exec(t)
  if (m) {
    const y = num(m[1])
    if (y < 1900 || y > 2199) {
      // 연도가 아니면 MMDD 로 한 번 더 시도한다(`1231` → 12월 31일).
      return dayTerm(thisYear, num(t.slice(0, 2)), num(t.slice(2)))
    }
    return yearTerm(y)
  }

  return null
}

/**
 * 명시적 날짜 표기인가 — `8월 13일`, `오늘`, `이번 주`, `D-7`.
 *
 * 참이면 낱말은 **명백히 날짜다**. 주소·이름에 "8월 13일" 이나 "오늘" 이 부분문자열로 들어갈
 * 일은 없으므로 텍스트 부분일치는 노이즈다. 반대로 `8-13`·`0831` 처럼 숫자만 있는 표기는
 * 애매하게 둔다 — 주소에 "산 8-13" 같은 번지가 실제로 있다.
 */
export function isExplicitDateTerm(term: string, now?: Date): boolean {
  return /[가-힣]|^[dD]\s*[+-]/.test(term.trim()) && parseDateTerm(term, now) !== null
}
