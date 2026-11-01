'use client'

// @oobleck/collection — 읽기전용 레코드 문서 뷰(공유 기질, L1).
//
// 원래 PeekPanel(components/workspace) 내부의 ReadOnlyRowView 였던 것을 컬렉션 층으로 내렸다:
// 시스템 DB 행 peek(워크스페이스)과 백오피스 드릴다운(모니터링)이 같은 "행=문서" 상세 관례를 쓰는데,
// 백오피스는 층위 분리(D-17 — backoffice ↛ workspace import)로 워크스페이스 컴포넌트를 가져올 수 없다.
// 규칙을 완화하는 대신 공유 기질을 아래(collections)로 내린다 — 공유는 L1 기질뿐이라는 원칙 그대로.
//
// 편집 affordance(제목 인풋·슬래시·자동저장) 없이 doc.properties 를 키:값으로, doc.body 를 알려진
// 블록(heading/codeBlock/bulletList/table/그 외 텍스트류)만 정적으로 렌더한다. 팩 무관 — 특정 property
// 키를 가정하지 않는다. properties.title 이 있으면(문자열) 본문 최상단에 큰 제목으로 뽑고 속성 목록에선
// 뺀다(중복 표시 방지). 바깥 여백은 호출자 몫(패널은 p-4 래퍼, 카드면 Surface 등 — 기질은 투명).

import { Button, Tag, Text, cn } from '../kit'
import type { BlockDocument, PropertyValue } from '@oobleck/collection'
import { optionColor } from '@oobleck/collection'
import { relativeValueLabel } from '@oobleck/collection'
import { isButtonValue, isTagValue } from '@oobleck/collection'
import type { DocBlockNode } from '@oobleck/collection'

// DocBlockNode 정본은 ../doc-blocks(비클라이언트 순수 모듈) — 여기서 재노출해 기존 deep-import
// (`@oobleck/collection/views/RecordDocumentView`)의 하위호환을 유지한다.
export type { DocBlockNode }

/** 블록 트리에서 순수 텍스트만 재귀 추출(문단·리스트아이템 등 content 배열을 평탄화). */
function blockText(node: DocBlockNode): string {
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.content)) return ''
  return node.content.map(blockText).join('')
}

/**
 * 구글독스식 인라인 표(@tiptap/extension-table) 정적 렌더 — 실제 에디터의 table/tableRow/
 * tableHeader/tableCell JSON 셰이프를 그대로 읽는다(편집 UI 없이 <table>로만). 셀 내용은 텍스트만
 * 지원(중첩 서식은 blockText 가 평탄화). colspan/rowspan(셀 병합)도 attrs 에서 그대로 옮긴다 —
 * 지금 생성 경로는 병합을 만들지 않지만(항상 1×1), 병합된 표를 만나도 그리드가 깨지지 않게 방어.
 */
function TableBlock({ rows }: { rows: DocBlockNode[] }) {
  // 표는 위아래 선만 — 목록 표(TableView)와 같은 문법. 머리 줄(tableHeader)은 옅은 면 + 흐린 글자.
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {(row.content ?? []).map((cell, ci) => {
              const Tag = cell.type === 'tableHeader' ? 'th' : 'td'
              const colSpan = typeof cell.attrs?.colspan === 'number' ? cell.attrs.colspan : 1
              const rowSpan = typeof cell.attrs?.rowspan === 'number' ? cell.attrs.rowspan : 1
              return (
                <Tag
                  key={ci}
                  colSpan={colSpan}
                  rowSpan={rowSpan}
                  className={cn(
                    'border-b border-border px-3 text-left align-middle',
                    cell.type === 'tableHeader'
                      ? 'bg-surface py-2 text-xs font-medium text-fg-subtle'
                      : 'py-2.5 text-fg',
                  )}
                >
                  {blockText(cell)}
                </Tag>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** 프로퍼티 값 표시 포맷(순수) — 배열/객체(geo)는 스칼라가 아니라 기본 문자열화가 위험해 타입별로 분기.
 *  button 은 인터랙티브 렌더 대상이라 여기 오지 않는다(호출부가 isButtonValue 로 먼저 분기). */
function formatPropertyValue(value: Exclude<PropertyValue, null>): string {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') {
    if ('roadAddress' in value) return value.roadAddress // GeoValue
    if ('tag' in value) return value.tag // TagValue(색 칩은 PropertyValueCell 이 먼저 분기 — 여긴 폴백)
    // 상대값은 **조건의 값**이지 레코드의 값이 아니다(relative-value 참고). 타입 union 이 넓어서
    // 여기 닿을 뿐이라, 뜻을 지어내지 않고 사람 말 표기를 그대로 쓴다.
    if ('rel' in value) return relativeValueLabel(value) ?? ''
    return value.label // ButtonValue(정상 경로는 isButtonValue 가 먼저 분기)
  }
  return String(value)
}

/**
 * 한 프로퍼티 값 셀 — 타입별 렌더. button(#289)=DS Button(클릭 onAction 위임, onAction 없으면 비활성),
 * tag(#312)=색 힌트 실은 DS Tag 칩(값의 color, 없으면 라벨 해시색), boolean(checkbox)=체크/대시 글리프,
 * 그 외=truncate 텍스트. 편집 UI 없는 정적 표시라 값만 보고 분기한다(스키마 무관 — 팩-무관 계약 유지).
 * geo·multi_select 등은 formatPropertyValue 폴백.
 */
function PropertyValueCell({
  value,
  onAction,
}: {
  value: Exclude<PropertyValue, null>
  onAction?: (action: string) => void
}) {
  if (isButtonValue(value)) {
    return (
      <Button
        variant={value.variant ?? 'outline'}
        size="sm"
        disabled={value.disabled === true || !onAction}
        onClick={() => onAction?.(value.action)}
      >
        {value.label}
      </Button>
    )
  }
  if (isTagValue(value)) {
    // 색 힌트를 실은 태그(#312 색 팔레트와 정합) — 명시색이 있으면 그 색, 없으면 라벨 해시색(TableView·카드와 동일 규칙).
    // 팩-무관 계약 유지: 스키마 없이 값에 실린 색만 읽는다(색 해소는 doc 빌더가 resolveOptionColor 로 선행).
    return (
      <Tag color={value.color ?? optionColor(value.tag)} size="sm">
        {value.tag}
      </Tag>
    )
  }
  if (typeof value === 'boolean') {
    return <span className="text-fg">{value ? '✓' : '—'}</span>
  }
  const text = formatPropertyValue(value)
  return (
    <span className="block min-w-0 truncate text-fg" title={text}>
      {text}
    </span>
  )
}

/**
 * RecordDocumentView — 읽기전용 "행=문서" 상세 렌더(컬렉션 상세/피크 관례의 정적 절반).
 * 소비처: PeekPanel(시스템 DB 행 peek)·백오피스 AI 추론 드릴다운·마켓플레이스 팩 상세. props 는
 * 직렬화 가능 데이터뿐(#237). onAction(선택) 은 button 프로퍼티(#289) 클릭을 호스트로 위임한다 —
 * 미지정이면 button 은 비활성 렌더(기존 소비처는 onAction 없이 그대로 동작, 하위호환).
 */
export function RecordDocumentView({
  doc,
  onAction,
}: {
  doc: BlockDocument
  onAction?: (action: string) => void
}) {
  const properties = doc.properties ?? {}
  const title = typeof properties.title === 'string' ? properties.title : null
  const entries = Object.entries(properties).filter(
    (e): e is [string, Exclude<PropertyValue, null>] =>
      e[0] !== 'title' && e[1] !== null && e[1] !== undefined,
  )
  const body = Array.isArray(doc.body) ? (doc.body as DocBlockNode[]) : []

  return (
    <div className="space-y-4">
      {title && (
        <Text as="h2" size="lg" weight="semibold">
          {title}
        </Text>
      )}
      {entries.length > 0 && (
        // 라벨 칸은 고정 폭(8rem) — 값이 칩·버튼·글자 어느 것이든 같은 세로줄에 선다(DescriptionRow compact 와 같은 위계).
        <dl className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-xs">
          {entries.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="font-medium text-fg-subtle">{key}</dt>
              <dd className="flex min-h-7 min-w-0 items-center">
                <PropertyValueCell value={value} onAction={onAction} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {/* 본문 — 속성 아래 가는 선으로 나눈다(속성이 없으면 선 없이). */}
      <div
        className={cn(
          'space-y-2',
          entries.length > 0 && body.length > 0 && 'border-t border-border-subtle pt-3',
        )}
      >
        {body.map((block, i) => {
          if (block.type === 'heading') {
            const level = typeof block.attrs?.level === 'number' ? block.attrs.level : 3
            return (
              <Text key={i} as={level <= 2 ? 'h2' : 'h3'} size="sm" weight="semibold">
                {blockText(block)}
              </Text>
            )
          }
          if (block.type === 'codeBlock') {
            return (
              <pre
                key={i}
                className="max-h-96 overflow-auto rounded-md bg-surface p-3 font-mono text-xs text-fg"
              >
                <code>{blockText(block)}</code>
              </pre>
            )
          }
          if (block.type === 'bulletList' && Array.isArray(block.content)) {
            return (
              <ul key={i} className="list-disc space-y-1 pl-5 text-sm text-fg">
                {block.content.map((li, j) => (
                  <li key={j}>{blockText(li)}</li>
                ))}
              </ul>
            )
          }
          if (block.type === 'table' && Array.isArray(block.content)) {
            return <TableBlock key={i} rows={block.content} />
          }
          const text = blockText(block)
          return text ? (
            <Text key={i} as="p" size="sm" tone="subtle" className="leading-relaxed">
              {text}
            </Text>
          ) : null
        })}
      </div>
    </div>
  )
}
