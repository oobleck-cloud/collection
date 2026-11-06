import type { RecordField } from './fields'

/** 칸 답 — 칸 키 → 값들(선택 칸은 선택지 값). */
export type FieldAnswers = Readonly<Record<string, readonly string[]>>

/**
 * 답 한 줄 — 칸 순서대로 「답할 생각 나중에 작성 · 다시 걸 날 2026-11-03」. 선택 칸은 선택지 이름으로, 빈 칸은 뺀다.
 * 칸을 모르면(템플릿이 아직 없다) 키 그대로, 답 순서대로.
 */
export function answerSummary(
  answers: FieldAnswers,
  fields: ReadonlyArray<Pick<RecordField, 'key' | 'label' | 'options'>> | null,
): string {
  if (!fields) {
    return Object.entries(answers)
      .map(([k, v]) => `${k} ${v.join(', ')}`)
      .join(' · ')
  }
  return fields
    .flatMap((f) => {
      const values = answers[f.key] ?? []
      if (values.length === 0) return []
      const text = values.map((v) => f.options.find((o) => o.value === v)?.label ?? v).join(', ')
      return [`${f.label} ${text}`]
    })
    .join(' · ')
}

/** 답 표의 한 줄 — 구역 이름(없으면 빈 글) 아래 「이름 — 답」. */
export type AnswerRow = { key: string; label: string; text: string; section: string }

/**
 * 폼 답 → 답 표 줄 — 폼 문항 차례대로, 이 사람에게 보이는 구역의 답한 문항만. 갈래(variant)가 있는 구역은 그 갈래를 받은 사람에게만.
 * 답을 글로 바꾸는 법([textOf])은 폼이 안다.
 */
export function answerRowsOf<Q extends { key: string; short: string }>(
  items: ReadonlyArray<{
    section: { title: string; variant?: string | null | undefined }
    question: Q
  }>,
  textOf: (question: Q) => string,
  variants: readonly string[] = [],
): AnswerRow[] {
  return items.flatMap(({ section, question }) => {
    if (section.variant && !variants.includes(section.variant)) return []
    const text = textOf(question)
    return text ? [{ key: question.key, label: question.short, text, section: section.title }] : []
  })
}

/** 답 줄을 구역으로 묶는다 — 구역이 처음 나온 차례대로. */
export function answerSections(
  rows: readonly AnswerRow[],
): Array<{ section: string; rows: AnswerRow[] }> {
  const order: string[] = []
  const by = new Map<string, AnswerRow[]>()
  for (const r of rows) {
    if (!by.has(r.section)) {
      order.push(r.section)
      by.set(r.section, [])
    }
    by.get(r.section)!.push(r)
  }
  return order.map((section) => ({ section, rows: by.get(section)! }))
}
