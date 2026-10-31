import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// Layout 패널 문구(로캘별) — co-located vocab. ko(default)는 기존 하드코딩과 바이트 동일(파리티).
const M = {
  cardAriaDisabled: {
    default: '{label} (준비 중)',
    en: '{label} (coming soon)',
    'zh-Hans': '{label}（开发中）',
  } satisfies Localized,
  cardTitleDisabled: {
    default: '{label} — 준비 중',
    en: '{label} — coming soon',
    'zh-Hans': '{label} — 开发中',
  } satisfies Localized,
  preparing: {
    default: '준비 중',
    en: 'Coming soon',
    'zh-Hans': '开发中',
  } satisfies Localized,
  dataSourceTitle: {
    default: '데이터 소스 제목 표시',
    en: 'Show data source title',
    'zh-Hans': '显示数据源标题',
  } satisfies Localized,
  pageIcon: {
    default: '페이지 아이콘 표시',
    en: 'Show page icon',
    'zh-Hans': '显示页面图标',
  } satisfies Localized,
  wrapAllContent: {
    default: '모든 콘텐츠 줄바꿈',
    en: 'Wrap all content',
    'zh-Hans': '所有内容自动换行',
  } satisfies Localized,
  rowHeight: {
    default: '행 높이',
    en: 'Row height',
    'zh-Hans': '行高',
  } satisfies Localized,
  sizeS: {
    default: '작게',
    en: 'Small',
    'zh-Hans': '小',
  } satisfies Localized,
  sizeM: {
    default: '보통',
    en: 'Medium',
    'zh-Hans': '中',
  } satisfies Localized,
  sizeL: {
    default: '크게',
    en: 'Large',
    'zh-Hans': '大',
  } satisfies Localized,
  groupBy: {
    default: '그룹 기준',
    en: 'Group by',
    'zh-Hans': '分组依据',
  } satisfies Localized,
  cardCover: {
    default: '카드 커버',
    en: 'Card cover',
    'zh-Hans': '卡片封面',
  } satisfies Localized,
  none: {
    default: '없음',
    en: 'None',
    'zh-Hans': '无',
  } satisfies Localized,
  pageOpenMode: {
    default: '페이지 열기 방식',
    en: 'Open pages in',
    'zh-Hans': '页面打开方式',
  } satisfies Localized,
  loadLimit: {
    default: '로드 제한',
    en: 'Load limit',
    'zh-Hans': '加载上限',
  } satisfies Localized,
  cardPropLabels: {
    default: '속성 이름표',
    en: 'Property labels',
    'zh-Hans': '属性标签',
  } satisfies Localized,
  cardSize: {
    default: '카드 크기',
    en: 'Card size',
    'zh-Hans': '卡片大小',
  } satisfies Localized,
  relationTable: {
    default: '관계 표',
    en: 'Relation table',
    'zh-Hans': '关联表',
  } satisfies Localized,
  relationTableRows: {
    default: '표 행 수',
    en: 'Table rows',
    'zh-Hans': '表格行数',
  } satisfies Localized,
  relationTableColumns: {
    default: '표 열',
    en: 'Table columns',
    'zh-Hans': '表格列',
  } satisfies Localized,
  relationTableVariant: {
    default: '표 모양',
    en: 'Table style',
    'zh-Hans': '表格样式',
  } satisfies Localized,
  variantTable: {
    default: '표',
    en: 'Table',
    'zh-Hans': '表格',
  } satisfies Localized,
  variantList: {
    default: '목록',
    en: 'List',
    'zh-Hans': '列表',
  } satisfies Localized,
  relationTableCollapsed: {
    default: '접어서 보기',
    en: 'Start collapsed',
    'zh-Hans': '默认折叠',
  } satisfies Localized,
  collapseEmptyGroups: {
    default: '빈 열 접기',
    en: 'Collapse empty columns',
    'zh-Hans': '折叠空列',
  } satisfies Localized,
  rowsCount: {
    default: '{count}행',
    en: '{count} rows',
    'zh-Hans': '{count} 行',
  } satisfies Localized,
  layout: {
    default: '레이아웃',
    en: 'Layout',
    'zh-Hans': '布局',
  } satisfies Localized,
}

export function layoutPanelCopy(locale: CollectionLocale) {
  return {
    cardAriaDisabled: (label: string) =>
      pickLocalized(M.cardAriaDisabled, locale).replace('{label}', label),
    cardTitleDisabled: (label: string) =>
      pickLocalized(M.cardTitleDisabled, locale).replace('{label}', label),
    preparing: pickLocalized(M.preparing, locale),
    dataSourceTitle: pickLocalized(M.dataSourceTitle, locale),
    pageIcon: pickLocalized(M.pageIcon, locale),
    wrapAllContent: pickLocalized(M.wrapAllContent, locale),
    rowHeight: pickLocalized(M.rowHeight, locale),
    sizeS: pickLocalized(M.sizeS, locale),
    sizeM: pickLocalized(M.sizeM, locale),
    sizeL: pickLocalized(M.sizeL, locale),
    groupBy: pickLocalized(M.groupBy, locale),
    cardCover: pickLocalized(M.cardCover, locale),
    none: pickLocalized(M.none, locale),
    pageOpenMode: pickLocalized(M.pageOpenMode, locale),
    loadLimit: pickLocalized(M.loadLimit, locale),
    cardSize: pickLocalized(M.cardSize, locale),
    cardPropLabels: pickLocalized(M.cardPropLabels, locale),
    relationTable: pickLocalized(M.relationTable, locale),
    relationTableRows: pickLocalized(M.relationTableRows, locale),
    relationTableColumns: pickLocalized(M.relationTableColumns, locale),
    relationTableVariant: pickLocalized(M.relationTableVariant, locale),
    variantTable: pickLocalized(M.variantTable, locale),
    variantList: pickLocalized(M.variantList, locale),
    relationTableCollapsed: pickLocalized(M.relationTableCollapsed, locale),
    collapseEmptyGroups: pickLocalized(M.collapseEmptyGroups, locale),
    rowsCount: (count: number) =>
      pickLocalized(M.rowsCount, locale).replace('{count}', String(count)),
    layout: pickLocalized(M.layout, locale),
  }
}
