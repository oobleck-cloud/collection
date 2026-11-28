import type { OptionColor } from '@oobleck/collection'
import type { TagColor } from '../kit'

/**
 * 컬렉션 태그 색(노션 9색 + teal) → systheme Tag 가 그리는 7색. systheme 에 없는 brown·yellow·pink 는
 * 가까운 색으로 그린다(저장된 값은 그대로). 워크벤치(Workstyle)는 10색을 모두 그린다.
 */
const NEAREST: Record<OptionColor, TagColor> = {
  gray: 'gray',
  brown: 'orange',
  orange: 'orange',
  yellow: 'orange',
  green: 'green',
  blue: 'blue',
  purple: 'purple',
  pink: 'purple',
  red: 'red',
  teal: 'teal',
}

export function systhemeTagColor(color: OptionColor): TagColor {
  return NEAREST[color]
}
