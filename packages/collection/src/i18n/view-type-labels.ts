import type { ViewType } from '../types'
import { pickLocalized, type CollectionLocale, type Localized } from './locale'

// 뷰 종류 표시 라벨(뷰 전환 스위처·"준비 중" 폴백 공용) — VIEW_SURFACES 레지스트리의 label(ko)을 로캘화한다.
// 레지스트리는 icon/Renderer 의 단일 출처로 두고, *표시 라벨*만 여기서 로캘별로 고른다(CollectionView·ViewToolbar 공용).
// ko 는 레지스트리 label 과 바이트 동일 — ko 출력 불변(파리티).
const VIEW_TYPE_LABELS: Partial<Record<ViewType, Localized>> = {
  table: { default: '표', en: 'Table', 'zh-Hans': '表格' },
  board: { default: '보드', en: 'Board', 'zh-Hans': '看板' },
  gallery: { default: '갤러리', en: 'Gallery', 'zh-Hans': '画廊' },
  list: { default: '리스트', en: 'List', 'zh-Hans': '列表' },
  timeline: { default: '타임라인', en: 'Timeline', 'zh-Hans': '时间线' },
  calendar: { default: '캘린더', en: 'Calendar', 'zh-Hans': '日历' },
  feed: { default: '피드', en: 'Feed', 'zh-Hans': '动态' },
  chart: { default: '차트', en: 'Chart', 'zh-Hans': '图表' },
  dashboard: { default: '대시보드', en: 'Dashboard', 'zh-Hans': '仪表盘' },
  map: { default: '지도', en: 'Map', 'zh-Hans': '地图' },
}

/** 뷰 종류 → 로캘 표시 라벨. 미등록 종류면 종류 문자열 그대로(방어적). */
export function viewTypeLabel(type: ViewType, locale: CollectionLocale): string {
  const l = VIEW_TYPE_LABELS[type]
  return l ? pickLocalized(l, locale) : String(type)
}
