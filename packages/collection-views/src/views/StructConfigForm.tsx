'use client'

import { Input, X, cn } from '@oobleck/systheme'

import {
  STRUCT_MAX_KEYS_PER_SLOT,
  STRUCT_MAX_SUMMARY_SLOTS,
  structRoleLabel,
  structSlotCandidates,
  structSlotsForLayout,
} from '@oobleck/collection'

import type { PropertyDef, StructConfig, StructLayout, StructSlot } from '@oobleck/collection'

// 구조 속성 저작 폼 — 배치 고르기 + 칸마다 가리킬 속성(순서 = 앞에서부터 첫 값) + 비교의 좋고 나쁨.
// 저장 · 검사는 호스트가 한다(`validateStructConfig` · `cleanStructConfig`). 이 폼은 값만 고친다.

const LAYOUTS: { value: StructLayout; label: string; hint: string }[] = [
  { value: 'compare', label: '비교', hint: 'A → B, 차이' },
  { value: 'range', label: '범위', hint: '하한 ~ 상한' },
  { value: 'route', label: '경로', hint: '출발 → 도착' },
  { value: 'summary', label: '요약', hint: '값 · 값 · 값' },
]

const BETTER: { value: StructConfig['better']; label: string }[] = [
  { value: undefined, label: '색 없음' },
  { value: 'lower', label: '낮을수록 좋음' },
  { value: 'higher', label: '높을수록 좋음' },
]

/** 새 구조 속성의 첫 모양 — 비교, 빈 칸. */
export function emptyStructConfig(): StructConfig {
  return { layout: 'compare', slots: structSlotsForLayout('compare', []) }
}

export function StructConfigForm({
  value,
  onChange,
  schema,
  problem,
}: {
  value: StructConfig
  onChange: (next: StructConfig) => void
  /** 칸이 가리킬 후보를 고를 스키마(표의 모든 컬럼). */
  schema: readonly PropertyDef[]
  /** 저장을 막는 이유(호스트의 검사 결과). 있으면 폼 아래에 보인다. */
  problem?: string | null
}) {
  const candidates = structSlotCandidates(schema)
  const setSlot = (index: number, slot: StructSlot) =>
    onChange({ ...value, slots: value.slots.map((s, i) => (i === index ? slot : s)) })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-fg-subtle">배치</span>
        <div className="grid grid-cols-4 gap-1">
          {LAYOUTS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() =>
                onChange({
                  layout: l.value,
                  slots: structSlotsForLayout(l.value, value.slots),
                  ...(l.value === 'compare' && value.better ? { better: value.better } : {}),
                })
              }
              className={cn(
                'flex flex-col items-start rounded border px-2 py-1.5 text-left transition-colors',
                value.layout === l.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-surface',
              )}
            >
              <span
                className={cn(
                  'text-xs font-medium',
                  value.layout === l.value ? 'text-primary' : 'text-fg',
                )}
              >
                {l.label}
              </span>
              <span className="text-[11px] text-fg-muted">{l.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-fg-subtle">
          칸 — 속성을 여럿 고르면 앞에서부터 첫 값
        </span>
        {value.slots.map((slot, index) => (
          <SlotRow
            key={`${slot.role}-${index}`}
            slot={slot}
            candidates={candidates}
            optional={slot.role === 'diff' || slot.role === 'state'}
            onChange={(next) => setSlot(index, next)}
            {...(value.layout === 'summary' && value.slots.length > 1
              ? {
                  onRemove: () =>
                    onChange({ ...value, slots: value.slots.filter((_, i) => i !== index) }),
                }
              : {})}
          />
        ))}
        {value.layout === 'summary' && value.slots.length < STRUCT_MAX_SUMMARY_SLOTS && (
          <button
            type="button"
            onClick={() =>
              onChange({ ...value, slots: [...value.slots, { role: 'item', keys: [] }] })
            }
            className="self-start rounded px-2 py-1 text-xs text-fg-subtle hover:bg-surface"
          >
            + 칸 추가
          </button>
        )}
      </div>

      {value.layout === 'compare' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-fg-subtle">차이의 좋고 나쁨</span>
          <div className="flex gap-1">
            {BETTER.map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => {
                  const { better: _, ...rest } = value
                  onChange(b.value ? { ...rest, better: b.value } : rest)
                }}
                className={cn(
                  'flex-1 rounded border px-2 py-1.5 text-xs transition-colors',
                  value.better === b.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-fg-muted hover:bg-surface',
                )}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <ActiveWhenPicker value={value} onChange={onChange} candidates={candidates} />

      {problem && <p className="text-xs text-warning-text">{problem}</p>}
    </div>
  )
}

function SlotRow({
  slot,
  candidates,
  optional,
  onChange,
  onRemove,
}: {
  slot: StructSlot
  candidates: PropertyDef[]
  optional: boolean
  onChange: (next: StructSlot) => void
  onRemove?: () => void
}) {
  const byKey = new Map(candidates.map((d) => [d.key, d]))
  const remaining = candidates.filter((d) => !slot.keys.includes(d.key))
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-surface p-2">
      <div className="flex items-center gap-2">
        <span className="w-12 shrink-0 text-xs font-medium text-fg">
          {structRoleLabel(slot.role)}
          {optional && <span className="text-fg-muted"> (선택)</span>}
        </span>
        <div className="min-w-0 flex-1">
          <Input
            size="sm"
            value={slot.label ?? ''}
            onValueChange={(label) => onChange({ ...slot, label })}
            placeholder={
              slot.keys[0]
                ? `칸 이름(비우면 ${byKey.get(slot.keys[0])?.label ?? '첫 속성'})`
                : '칸 이름'
            }
          />
        </div>
        {onRemove && (
          <button
            type="button"
            aria-label="칸 지우기"
            onClick={onRemove}
            className="inline-flex size-6 items-center justify-center rounded text-fg-muted hover:bg-background"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 pl-14">
        {slot.keys.map((key, i) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs text-fg"
          >
            {i > 0 && <span className="text-fg-muted">없으면</span>}
            {byKey.get(key)?.label ?? key}
            <button
              type="button"
              aria-label={`${byKey.get(key)?.label ?? key} 빼기`}
              onClick={() => onChange({ ...slot, keys: slot.keys.filter((k) => k !== key) })}
              className="text-fg-muted hover:text-fg"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        {slot.keys.length < STRUCT_MAX_KEYS_PER_SLOT && (
          <select
            value=""
            aria-label={`${structRoleLabel(slot.role)} 칸에 속성 더하기`}
            onChange={(e) => {
              if (e.target.value) onChange({ ...slot, keys: [...slot.keys, e.target.value] })
            }}
            className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-fg-subtle outline-none focus:border-primary"
          >
            <option value="">{slot.keys.length === 0 ? '+ 속성 고르기' : '+ 없으면 이것'}</option>
            {remaining.map((d) => (
              <option key={d.key} value={d.key}>
                {d.group?.length ? `${d.group.join(' › ')} › ${d.label}` : d.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

/**
 * 「켜는 응답」 — 응답(state) 칸이 선택 속성을 가리키면 그 선택지 중 수 칸을 켜는 값을 고른다(「금액 받음」).
 * 아무것도 고르지 않으면 응답은 함께 보이기만 하고 수 칸을 끄지 않는다.
 */
function ActiveWhenPicker({
  value,
  onChange,
  candidates,
}: {
  value: StructConfig
  onChange: (next: StructConfig) => void
  candidates: PropertyDef[]
}) {
  const stateKey = value.slots.find((s) => s.role === 'state')?.keys[0]
  const stateDef = stateKey ? candidates.find((d) => d.key === stateKey) : undefined
  const options = (stateDef?.options ?? []).map((o) =>
    typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: o.label ?? o.value },
  )
  if (!stateDef || options.length === 0) return null
  const selected = new Set(value.activeWhen ?? [])
  const toggle = (option: string) => {
    const next = selected.has(option)
      ? [...selected].filter((v) => v !== option)
      : [...selected, option]
    const { activeWhen: _, ...rest } = value
    onChange(next.length > 0 ? { ...rest, activeWhen: next } : rest)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-fg-subtle">
        켜는 응답 — 이 응답일 때만 수 칸을 적는다
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cn(
              'rounded border px-2 py-1 text-xs transition-colors',
              selected.has(o.value)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-fg-muted hover:bg-surface',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
