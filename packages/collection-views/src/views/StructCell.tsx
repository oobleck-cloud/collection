'use client'

import { AnchorContextSurface, cn } from '../kit'
import { useState } from 'react'

import {
  formatSignedUnitNumber,
  formatStructText,
  resolveStruct,
  slotText,
  type ResolvedStruct,
  type ResolvedStructSlot,
  type StructSlotSource,
} from '@oobleck/collection'

import type { PropertyDef, PropertyValue, StructSlotRole } from '@oobleck/collection'
import type { ReactNode } from 'react'

// 구조 속성의 세 자리 — 표 칸 한 줄(StructCell) · 카드 수치 띠(StructBand) · 칸별 편집기 묶음(StructEditor).
// 값을 읽는 규칙은 ../struct 하나다. 여기는 모양만 갖는다.

/**
 * 칸 편집기 한 칸을 그리는 함수 — 호스트(TableView 의 `Cell`)가 넘긴다.
 * 이 파일이 Cell 을 직접 import 하지 않는 이유: TableView 가 이 파일을 쓰므로 순환이 된다.
 */
export type StructFieldRenderer = (
  def: PropertyDef,
  value: PropertyValue,
  onChange: ((value: PropertyValue) => void) | undefined,
) => ReactNode

const TONE_CLASS: Record<'good' | 'bad', string> = {
  good: 'text-success-text',
  bad: 'text-warning-text',
}

function toneClass(tone: ResolvedStruct['diffTone']): string | undefined {
  return tone ? TONE_CLASS[tone] : undefined
}

function slotOf(resolved: ResolvedStruct, role: StructSlotRole): ResolvedStructSlot | undefined {
  return resolved.slots.find((s) => s.slot.role === role)
}

/** 「앞에서부터 첫 값」 칸이 첫 키가 아닌 값을 쓰고 있으면 그 속성 이름 — 「기준가 · 타업체」의 뒷부분. */
function fallbackNote(slot: ResolvedStructSlot): string | null {
  if (!slot.used || slot.sources.length < 2 || slot.used === slot.sources[0]) return null
  return slot.used.def.label
}

// ─── 표 칸 ────────────────────────────────────────────────────────────────────

/**
 * 표 칸 — 한 줄(「200만 → 205만 (+5만)」). 차이는 좋고 나쁨 색. 고칠 수 있으면 누르면 칸별 편집기 팝오버.
 */
export function StructCell({
  def,
  props,
  schema,
  edit,
  renderField,
}: {
  def: PropertyDef
  props: Record<string, PropertyValue>
  schema: readonly PropertyDef[]
  edit?: (key: string, value: PropertyValue) => void
  renderField: StructFieldRenderer
}) {
  const [open, setOpen] = useState(false)
  const resolved = resolveStruct(def, props, schema)
  const line = <StructLine resolved={resolved} />
  if (!edit || !resolved) return line
  return (
    <AnchorContextSurface
      layout="inline"
      open={open}
      onOpenChange={setOpen}
      panelRole="dialog"
      panelPlacement="below"
      panelAriaLabel={def.label}
      panelClassName="w-80 p-3"
      surface={
        <button
          type="button"
          data-table-row-stop
          onClick={(e) => {
            e.stopPropagation()
            setOpen((o) => !o)
          }}
          className="flex w-full min-w-0 items-center text-left"
        >
          {line}
        </button>
      }
      panel={
        <StructEditor
          def={def}
          props={props}
          schema={schema}
          edit={edit}
          renderField={renderField}
          bare
        />
      }
    />
  )
}

/** 한 줄 글자 — compare 는 차이만 색을 입힌다. 비었으면 「—」. */
function StructLine({ resolved }: { resolved: ResolvedStruct | null }) {
  const text = formatStructText(resolved)
  if (!resolved || !text) return <span className="text-fg-muted">—</span>
  if (resolved.layout !== 'compare' || resolved.diff === null)
    return (
      <span className="truncate tabular-nums text-fg" title={text}>
        {text}
      </span>
    )
  const diff = `(${formatSignedUnitNumber(resolved.diff, resolved.unit)})`
  const head = text.slice(0, text.length - diff.length).trimEnd()
  return (
    <span className="flex min-w-0 items-center gap-1 tabular-nums" title={text}>
      <span className="truncate text-fg">{head}</span>
      <span className={cn('shrink-0 font-medium', toneClass(resolved.diffTone))}>{diff}</span>
    </span>
  )
}

// ─── 카드 수치 띠 ────────────────────────────────────────────────────────────────

/**
 * 카드 수치 띠 — 보드 · 갤러리 카드에서 구조 속성은 이름표 줄 대신 띠로 선다.
 * compare: 「기준가 → 대상」 + 오른쪽 차이. range/route: 두 칸. summary: 한 줄.
 */
export function StructBand({
  def,
  props,
  schema,
}: {
  def: PropertyDef
  props: Record<string, PropertyValue>
  schema: readonly PropertyDef[]
}) {
  const resolved = resolveStruct(def, props, schema)
  if (!resolved || resolved.empty) return null
  // 수 칸이 꺼졌다(응답 「모름」) — 응답 하나만 보인다.
  if (!resolved.active && resolved.state)
    return (
      <div className="flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-xs">
        <span className="text-fg-subtle">{resolved.state.label}</span>
        <span className="font-medium text-fg">{slotText(resolved.state, resolved.unit)}</span>
      </div>
    )
  if (resolved.layout === 'summary')
    return (
      <div className="truncate rounded-md bg-surface px-3 py-2 text-xs text-fg">
        {formatStructText(resolved)}
      </div>
    )
  const [a, b] =
    resolved.layout === 'range'
      ? [slotOf(resolved, 'min'), slotOf(resolved, 'max')]
      : [slotOf(resolved, 'from'), slotOf(resolved, 'to')]
  const sep = resolved.layout === 'range' ? '~' : '→'
  return (
    <div
      className="flex items-end justify-between gap-3 rounded-md bg-surface p-3"
      title={formatStructText(resolved)}
    >
      <div className="flex min-w-0 items-end gap-3">
        {a && <BandFigure slot={a} resolved={resolved} />}
        <span className="pb-0.5 text-sm text-fg-muted" aria-hidden>
          {sep}
        </span>
        {b && <BandFigure slot={b} resolved={resolved} />}
      </div>
      {resolved.layout === 'compare' && resolved.diff !== null && (
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-[11px] text-fg-subtle">
            {slotOf(resolved, 'diff')?.label ?? '차이'}
          </span>
          <span className={cn('text-base font-bold tabular-nums', toneClass(resolved.diffTone))}>
            {formatSignedUnitNumber(resolved.diff, resolved.unit)}
          </span>
        </div>
      )}
    </div>
  )
}

function BandFigure({ slot, resolved }: { slot: ResolvedStructSlot; resolved: ResolvedStruct }) {
  const note = fallbackNote(slot)
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-[11px] text-fg-subtle">
        {note ? `${slot.label} · ${note}` : slot.label}
      </span>
      <span className="truncate text-base font-semibold tabular-nums text-fg">
        {slotText(slot, resolved.unit) || '—'}
      </span>
    </div>
  )
}

// ─── 칸별 편집기 묶음 ─────────────────────────────────────────────────────────────

/**
 * 칸별 원래 편집기 묶음 — 상세 · 콜 폼 · 표 칸 팝오버.
 *
 * 고치면 그 칸의 **밑 속성**을 고친다(구조 속성 키로는 아무것도 쓰지 않는다). 「앞에서부터 첫 값」 칸은
 * 모든 키의 편집기를 보이고 지금 쓰는 키에 「쓰는 값」을 단다. 읽기 전용 칸(계산 열 · 권한 없음)은 값만.
 */
export function StructEditor({
  def,
  props,
  schema,
  edit,
  renderField,
  bare = false,
}: {
  def: PropertyDef
  props: Record<string, PropertyValue>
  schema: readonly PropertyDef[]
  edit?: (key: string, value: PropertyValue) => void
  renderField: StructFieldRenderer
  /** 머리(이름 · 차이)를 빼고 칸만 — 표 칸 팝오버처럼 바깥이 이미 이름을 보일 때. */
  bare?: boolean
}) {
  const resolved = resolveStruct(def, props, schema)
  if (!resolved) return null
  return (
    <div className="flex flex-col gap-2">
      {!bare && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-fg">{def.label}</span>
          {resolved.layout === 'compare' && resolved.diff !== null && (
            <span className={cn('text-xs font-semibold', toneClass(resolved.diffTone))}>
              {slotOf(resolved, 'diff')?.label ?? '차이'}{' '}
              {formatSignedUnitNumber(resolved.diff, resolved.unit)}
            </span>
          )}
        </div>
      )}
      {resolved.slots
        .filter((slot) => slot.sources.length > 0)
        .map((slot) => (
          <EditorSlot
            key={slot.id}
            slot={slot}
            props={props}
            // 응답이 수 칸을 껐으면(「모름」) 수 칸은 값만 — 응답을 「금액 받음」으로 바꾸면 다시 켜진다.
            {...(resolved.active || slot.slot.role === 'state' ? { edit } : {})}
            renderField={renderField}
          />
        ))}
    </div>
  )
}

function EditorSlot({
  slot,
  props,
  edit,
  renderField,
}: {
  slot: ResolvedStructSlot
  props: Record<string, PropertyValue>
  edit?: (key: string, value: PropertyValue) => void
  renderField: StructFieldRenderer
}) {
  const chain = slot.sources.length > 1
  const field = (source: StructSlotSource) => (
    <EditorField
      key={source.key}
      source={source}
      value={props[source.key] ?? null}
      using={chain && slot.used === source}
      label={chain ? source.def.label : slot.label}
      edit={edit}
      renderField={renderField}
    />
  )
  if (!chain) return field(slot.sources[0] as StructSlotSource)
  return (
    <div className="flex flex-col gap-1 rounded-md bg-surface p-2">
      <span className="text-[11px] font-semibold text-fg-subtle">
        {slot.label} — 앞에서부터 첫 값
      </span>
      {slot.sources.map(field)}
    </div>
  )
}

const UNIT_SUFFIX = { won: '원', manwon: '만' } as const

function EditorField({
  source,
  value,
  using,
  label,
  edit,
  renderField,
}: {
  source: StructSlotSource
  value: PropertyValue
  using: boolean
  label: string
  edit?: (key: string, value: PropertyValue) => void
  renderField: StructFieldRenderer
}) {
  const writable = source.def.source === 'frontmatter' && !!edit
  const unit = source.def.unit ? ` (${UNIT_SUFFIX[source.def.unit]})` : ''
  return (
    <div className="flex min-h-8 items-center gap-2">
      <span className="flex w-36 shrink-0 items-center gap-1.5 text-xs text-fg-subtle">
        <span className="truncate">
          {label}
          {unit}
        </span>
        {using && (
          <span className="shrink-0 rounded bg-info-subtle px-1.5 text-[10px] font-semibold text-info-text">
            쓰는 값
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        {renderField(source.def, value, writable ? (v) => edit?.(source.key, v) : undefined)}
      </div>
    </div>
  )
}
