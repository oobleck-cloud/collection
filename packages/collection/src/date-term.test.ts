// 낱말 → 날짜 파서.
//
// 이 파일이 지키는 것: **사람이 실제로 치는 말**을 읽는가. 운영에서 `2026-08-13` 이라고 치지
// 않는다 — `오늘`, `이번 주`, `8월 13일`, `0831`, `D-7` 이라고 친다. 못 읽으면 자동완성은
// 날짜 컬럼에 대해 침묵하고, 사용자는 "날짜로는 못 거르는구나" 로 결론짓는다.
//
// `now` 를 전부 주입한다 — 상대 표현은 오늘이 언제냐에 따라 답이 달라지므로, 고정하지 않으면
// 테스트가 달력 때문에 깨지고 그 실패는 코드 탓이 아니라 원인을 찾기 어렵다.

import { describe, expect, it } from 'vitest'

import { isExplicitDateTerm, parseDateTerm } from './date-term'

// 2026-08-16 은 **일요일**이다 — 주 경계(월요일 시작)를 제대로 다루는지 보려면
// 일요일 기준이 가장 잘 드러난다(순진하게 짜면 한 주가 밀린다).
const SUN = new Date(2026, 7, 16)
/** 2026-08-13 은 목요일 — 주 중간 기준. */
const THU = new Date(2026, 7, 13)

const range = (t: ReturnType<typeof parseDateTerm>) => [t?.start, t?.end]

describe('상대 — 하루', () => {
  it('오늘·내일·어제·모레', () => {
    expect(range(parseDateTerm('오늘', SUN))).toEqual(['2026-08-16', '2026-08-16'])
    expect(range(parseDateTerm('내일', SUN))).toEqual(['2026-08-17', '2026-08-17'])
    expect(range(parseDateTerm('어제', SUN))).toEqual(['2026-08-15', '2026-08-15'])
    expect(range(parseDateTerm('모레', SUN))).toEqual(['2026-08-18', '2026-08-18'])
    expect(range(parseDateTerm('그제', SUN))).toEqual(['2026-08-14', '2026-08-14'])
  })

  it('달 경계를 넘어간다', () => {
    expect(range(parseDateTerm('내일', new Date(2026, 7, 31)))).toEqual([
      '2026-09-01',
      '2026-09-01',
    ])
  })
})

describe('상대 — 주(월요일 시작)', () => {
  it('일요일에 "이번 주" 는 그 앞의 월요일부터다', () => {
    // 일=0 을 그대로 쓰면 한 주가 밀린다. 8/16(일)의 이번 주는 8/10~8/16.
    expect(range(parseDateTerm('이번 주', SUN))).toEqual(['2026-08-10', '2026-08-16'])
  })

  it('주 중간에도 같은 주를 가리킨다', () => {
    expect(range(parseDateTerm('이번주', THU))).toEqual(['2026-08-10', '2026-08-16'])
  })

  it('지난주·다음주', () => {
    expect(range(parseDateTerm('지난주', THU))).toEqual(['2026-08-03', '2026-08-09'])
    expect(range(parseDateTerm('다음 주', THU))).toEqual(['2026-08-17', '2026-08-23'])
  })

  it('띄어쓰기는 사람마다 다르다 — 둘 다 읽는다', () => {
    expect(range(parseDateTerm('이번 주', THU))).toEqual(range(parseDateTerm('이번주', THU)))
  })
})

describe('상대 — 달·해', () => {
  it('이번 달은 그 달의 1일~말일', () => {
    expect(range(parseDateTerm('이번 달', THU))).toEqual(['2026-08-01', '2026-08-31'])
  })

  it('지난달·다음달 — 연 경계도 넘는다', () => {
    expect(range(parseDateTerm('지난달', THU))).toEqual(['2026-07-01', '2026-07-31'])
    expect(range(parseDateTerm('다음달', new Date(2026, 11, 5)))).toEqual([
      '2027-01-01',
      '2027-01-31',
    ])
    expect(range(parseDateTerm('지난달', new Date(2026, 0, 5)))).toEqual([
      '2025-12-01',
      '2025-12-31',
    ])
  })

  it('올해·작년·내년', () => {
    expect(range(parseDateTerm('올해', THU))).toEqual(['2026-01-01', '2026-12-31'])
    expect(range(parseDateTerm('작년', THU))).toEqual(['2025-01-01', '2025-12-31'])
    expect(range(parseDateTerm('내년', THU))).toEqual(['2027-01-01', '2027-12-31'])
  })
})

describe('상대 — 요일·오프셋', () => {
  it('요일은 그 주(월~일)의 해당 요일', () => {
    expect(range(parseDateTerm('금요일', THU))).toEqual(['2026-08-14', '2026-08-14'])
    expect(range(parseDateTerm('월', THU))).toEqual(['2026-08-10', '2026-08-10'])
    // 일요일은 그 주의 **마지막** 날이다(월요일 시작이므로).
    expect(range(parseDateTerm('일요일', THU))).toEqual(['2026-08-16', '2026-08-16'])
  })

  it('주 지정 + 요일', () => {
    expect(range(parseDateTerm('다음주 금요일', THU))).toEqual(['2026-08-21', '2026-08-21'])
    expect(range(parseDateTerm('지난주 월요일', THU))).toEqual(['2026-08-03', '2026-08-03'])
  })

  it('N일/주 전·후', () => {
    expect(range(parseDateTerm('3일 전', THU))).toEqual(['2026-08-10', '2026-08-10'])
    expect(range(parseDateTerm('일주일 후', THU))).toEqual(['2026-08-20', '2026-08-20'])
    expect(range(parseDateTerm('2주 전', THU))).toEqual(['2026-07-30', '2026-07-30'])
  })

  it('N개월 전·후는 달 범위', () => {
    expect(range(parseDateTerm('2개월 전', THU))).toEqual(['2026-06-01', '2026-06-30'])
  })

  it('D-7 / D+3 — 미소 내부 표기', () => {
    expect(range(parseDateTerm('D-7', THU))).toEqual(['2026-08-06', '2026-08-06'])
    expect(range(parseDateTerm('D+3', THU))).toEqual(['2026-08-16', '2026-08-16'])
    expect(range(parseDateTerm('d-1', THU))).toEqual(['2026-08-12', '2026-08-12'])
  })
})

describe('절대', () => {
  it('한국어', () => {
    expect(range(parseDateTerm('8월 13일', SUN))).toEqual(['2026-08-13', '2026-08-13'])
    expect(range(parseDateTerm('8월13일', SUN))).toEqual(['2026-08-13', '2026-08-13'])
    expect(range(parseDateTerm('2025년 8월 13일', SUN))).toEqual(['2025-08-13', '2025-08-13'])
    expect(range(parseDateTerm('8월', SUN))).toEqual(['2026-08-01', '2026-08-31'])
  })

  it('구분자·붙여쓰기', () => {
    for (const t of ['2026-08-13', '2026.8.13', '2026/08/13', '20260813']) {
      expect(range(parseDateTerm(t, SUN)), t).toEqual(['2026-08-13', '2026-08-13'])
    }
    expect(range(parseDateTerm('8/13', SUN))).toEqual(['2026-08-13', '2026-08-13'])
  })

  it('MMDD 압축 — 선행 0 이 날짜임을 알린다', () => {
    // 주문번호는 0 으로 시작하지 않으므로 `0831` 은 일련번호가 아니라 8월 31일이다.
    expect(range(parseDateTerm('0831', SUN))).toEqual(['2026-08-31', '2026-08-31'])
    expect(range(parseDateTerm('0102', SUN))).toEqual(['2026-01-02', '2026-01-02'])
    // 세 자리 `831` 도 8월 31일.
    expect(range(parseDateTerm('831', SUN))).toEqual(['2026-08-31', '2026-08-31'])
  })

  it('연도로 볼 수 없는 네 자리는 MMDD 로 읽는다', () => {
    expect(range(parseDateTerm('1231', SUN))).toEqual(['2026-12-31', '2026-12-31'])
    expect(range(parseDateTerm('2026', SUN))).toEqual(['2026-01-01', '2026-12-31'])
  })

  it('없는 날짜는 만들지 않는다 · 윤년은 살린다', () => {
    expect(parseDateTerm('13월 1일', SUN)).toBeNull()
    expect(parseDateTerm('2월 30일', SUN)).toBeNull()
    expect(parseDateTerm('1350', SUN)).toBeNull() // 13월 50일
    expect(range(parseDateTerm('2024년 2월 29일', SUN))).toEqual(['2024-02-29', '2024-02-29'])
    expect(parseDateTerm('2026년 2월 29일', SUN)).toBeNull()
  })

  it('아직 날짜가 아닌 조각은 값을 지어내지 않는다', () => {
    expect(parseDateTerm('2026-0', SUN)).toBeNull()
    expect(parseDateTerm('2026-09', SUN)?.precision).toBe('month')
  })

  it('낱말·전화번호는 날짜가 아니다', () => {
    for (const t of ['부평', '관악', '010-1234-5678', '01012345678', '']) {
      expect(parseDateTerm(t, SUN), t).toBeNull()
    }
  })
})

describe('isExplicitDateTerm — 텍스트 부분일치를 걷어낼 대상인가', () => {
  it('한국어 표기·D 표기는 명백한 날짜다', () => {
    for (const t of ['오늘', '이번 주', '8월 13일', '지난달', 'D-7', '금요일']) {
      expect(isExplicitDateTerm(t, SUN), t).toBe(true)
    }
  })

  it('숫자만 있는 표기는 애매하게 둔다 — 주소에 "산 8-13" 같은 번지가 있다', () => {
    for (const t of ['8-13', '0831', '2026-08-13', '1231']) {
      expect(isExplicitDateTerm(t, SUN), t).toBe(false)
    }
  })

  it('날짜가 아닌 한국어는 대상이 아니다', () => {
    expect(isExplicitDateTerm('관악', SUN)).toBe(false)
  })
})
