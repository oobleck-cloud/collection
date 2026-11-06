import { answerSections, type AnswerRow } from './answers'

/**
 * 답 표 — 구역마다 카드 하나, 카드 안은 「이름 — 답」 줄. 색 · 글자는 systheme 토큰 클래스(Tailwind)라 호스트가 이 폴더를 @source 로 훑는다.
 * 답이 없으면 아무것도 그리지 않는다.
 */
export function AnswerSections({
  rows,
  labelWidth = 112,
  className,
}: {
  rows: readonly AnswerRow[]
  labelWidth?: number
  className?: string
}) {
  if (rows.length === 0) return null
  return (
    <div className={className ?? 'grid gap-4 sm:grid-cols-2'}>
      {answerSections(rows).map(({ section, rows: inSection }) => (
        <dl
          key={section}
          className="flex flex-col gap-1.5 rounded-xl bg-background p-3.5 text-sm"
          data-section={section || undefined}
        >
          {section ? <p className="pb-1 text-xs font-semibold text-fg-subtle">{section}</p> : null}
          {inSection.map((a) => (
            <div
              key={a.key}
              className="grid gap-2"
              style={{ gridTemplateColumns: `${String(labelWidth)}px minmax(0,1fr)` }}
            >
              <dt className="text-fg-muted">{a.label}</dt>
              <dd className="whitespace-pre-wrap text-fg">{a.text}</dd>
            </div>
          ))}
        </dl>
      ))}
    </div>
  )
}
