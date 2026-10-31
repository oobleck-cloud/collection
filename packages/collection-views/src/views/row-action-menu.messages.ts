import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// RowActionMenu 문구(로캘별). ko(default)는 TableView 인라인 케밥과 바이트 동일(파리티), en·zh-Hans 관용 번역.
const M = {
  rowMenuAria: { default: '행 메뉴', en: 'Row menu', 'zh-Hans': '行菜单' } satisfies Localized,
  deleteRow: { default: '삭제', en: 'Delete', 'zh-Hans': '删除' } satisfies Localized,
}

export function rowActionMenuCopy(locale: CollectionLocale) {
  return {
    rowMenuAria: pickLocalized(M.rowMenuAria, locale),
    deleteRow: pickLocalized(M.deleteRow, locale),
  }
}
