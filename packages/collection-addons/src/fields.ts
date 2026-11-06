/**
 * 폼 문항 → 기록 칸 → 속성 정의.
 *
 * 폼(랜딩 · 설문)과 기록 칸(콜 템플릿 같은 사람이 받아 적는 칸)은 따로 정의되고, 이 옮김으로만 잇는다(단방향): 폼을 고쳐도 칸은
 * 그대로고, 칸에서 받은 답이 폼 답으로 돌아가지 않는다. 칸 문법은 컬렉션 속성과 같아서([attributeDefsOf]) 속성 칸 편집기로 그린다.
 *
 * 앱 타입을 모른다 — 문항 · 칸은 구조로만 받는다. 앱 고유의 문항 종류는 [FieldsOptions.custom] 으로 옮긴다.
 */

export type FieldType = 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTI_SELECT' | 'DATE' | 'CHECKBOX'
export type AttributeType = 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox'

export type FieldOption = { value: string; label: string }

/** 기록 칸 하나 — 키 · 이름 · 종류 · 선택지 · 꼭 받는가. 앱은 여기에 제 값(콜 결과 등)을 더해 쓴다. */
export type RecordField = {
  key: string
  label: string
  type: FieldType
  required: boolean
  options: FieldOption[]
}

/** 옮길 수 있는 문항 — 키 · 짧은 이름 · 종류. 선택 문항은 선택지(요약 이름이 있으면 그것)를 갖는다. */
export type FormQuestionLike = {
  key: string
  short: string
  kind: string
  options?: ReadonlyArray<{ value: string; label: string; summary?: string | undefined }>
}

export type FieldsOptions<Q extends FormQuestionLike> = {
  /** 칸 이름 길이 — 넘치면 자른다. 기본 60. */
  labelMax?: number
  /**
   * 기본 종류(choice · multi · text · number) 밖의 문항 — 칸 하나를 돌려주면 그것(이름 자르기 · 키는 여기서 맞춘다), null 이면 뺀다.
   * 기본 종류도 여기서 먼저 받으면 덮어쓴다.
   */
  custom?: (question: Q, base: RecordField) => RecordField | null | undefined
}

const LABEL_MAX = 60

/** 문항 키(`otherKinds`) → 칸 키(`other_kinds`) — 칸 키는 소문자 · 숫자 · 밑줄만 받는다. */
export function fieldKey(questionKey: string): string {
  return questionKey.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

/** 문항들 → 칸들. 모두 선택 칸(required false) — 받아 적는 쪽은 문항을 다 묻지 못한다. 모르는 종류는 뺀다. */
export function fieldsOfQuestions<Q extends FormQuestionLike>(
  questions: readonly Q[],
  options: FieldsOptions<Q> = {},
): RecordField[] {
  const max = options.labelMax ?? LABEL_MAX
  return questions.flatMap((q) => {
    const base: RecordField = {
      key: fieldKey(q.key),
      label: q.short.slice(0, max),
      type: 'TEXT',
      required: false,
      options: [],
    }
    const custom = options.custom?.(q, base)
    if (custom === null) return []
    if (custom) return [{ ...custom, key: base.key, label: custom.label.slice(0, max) }]
    const field = defaultField(q, base)
    return field ? [field] : []
  })
}

function defaultField(q: FormQuestionLike, base: RecordField): RecordField | null {
  switch (q.kind) {
    case 'choice':
    case 'multi':
      return {
        ...base,
        type: q.kind === 'choice' ? 'SELECT' : 'MULTI_SELECT',
        options: (q.options ?? []).map((o) => ({ value: o.value, label: o.summary ?? o.label })),
      }
    case 'text':
      return { ...base, type: 'TEXT' }
    case 'number':
      return { ...base, type: 'NUMBER' }
    default:
      return null
  }
}

const ATTRIBUTE_TYPE: Record<FieldType, AttributeType> = {
  TEXT: 'text',
  NUMBER: 'number',
  SELECT: 'select',
  MULTI_SELECT: 'multi_select',
  DATE: 'date',
  CHECKBOX: 'checkbox',
}

export function attributeTypeOf(type: FieldType): AttributeType {
  return ATTRIBUTE_TYPE[type]
}

/** 칸 → 속성 정의 모양 — 정의일 뿐 속성이 아니다(저장소에 없고, 답은 칸 답으로만 남는다). 앱은 상태 등 제 값을 더한다. */
export function attributeDefsOf(
  fields: ReadonlyArray<Pick<RecordField, 'key' | 'label' | 'type' | 'options'>>,
): Array<{ key: string; label: string; type: AttributeType; options: FieldOption[] }> {
  return fields.map((f) => ({
    key: f.key,
    label: f.label,
    type: ATTRIBUTE_TYPE[f.type],
    options: f.options.map((o) => ({ value: o.value, label: o.label })),
  }))
}
