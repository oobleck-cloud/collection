import type { PropertyDef, PresetSet } from './types'

// 스키마 합성 — 동적 베이스 + 정적 프리셋 세트(D-8 §3 확정).
// 컬렉션은 *동적 베이스*(사용자가 자유 추가한 컬럼) 위에 블록팩이 정의한 *프리셋 세트*(정적 묶음)를
// 얹어 시작한다. effective 스키마는 둘을 합친 PropertyDef[] 다.

/**
 * 동적 베이스 + 적용된 프리셋 세트들을 합쳐 effective 스키마를 만든다.
 *
 * 충돌 규칙(결정):
 *  - **같은 key 는 base 가 우선한다.** 사용자가 명시적으로 추가/재정의한 베이스 컬럼이
 *    프리셋의 기본 정의를 덮는다(파워유저/AI의 자유 확장이 정적 기본보다 우선 — D-6 Primitive>Preset 의도).
 *  - 프리셋 세트들 사이의 충돌은 **먼저 적용된 세트가 우선**(presets 배열 순서). 안정적·예측 가능.
 *  - 한 세트 내부에 같은 key 가 둘이면 그 세트에서 먼저 나온 것이 우선.
 *
 * 출력 순서: base 의 순서를 먼저, 그 뒤 프리셋(세트 순서 → 세트 내 순서)에서 아직 안 쓰인 key 를 덧붙인다.
 * → 사용자 정의 컬럼이 앞쪽에, 프리셋 기본 컬럼이 뒤쪽에 안정적으로 배치된다.
 */
export function composeSchema(base: PropertyDef[], presets: PresetSet[]): PropertyDef[] {
  const seen = new Set<string>()
  const result: PropertyDef[] = []

  // 1) base 먼저(우선). base 내부 중복 key 는 첫 정의만.
  for (const def of base) {
    if (seen.has(def.key)) continue
    seen.add(def.key)
    result.push(def)
  }

  // 2) 프리셋 세트 순서대로, 아직 안 쓰인 key 만 덧붙임(base·앞선 세트가 이미 점유했으면 건너뜀).
  for (const preset of presets) {
    for (const def of preset.props) {
      if (seen.has(def.key)) continue
      seen.add(def.key)
      result.push(def)
    }
  }

  return result
}
