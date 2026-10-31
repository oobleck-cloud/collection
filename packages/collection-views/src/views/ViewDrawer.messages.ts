import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// ViewDrawer 문구(로캘별) — co-located vocab. ko 가 기본.
const M = {
  drawerAria: {
    default: '뷰 서랍',
    en: 'View drawer',
    'zh-Hans': '视图抽屉',
  } satisfies Localized,
  openDrawer: {
    default: '뷰',
    en: 'View',
    'zh-Hans': '视图',
  } satisfies Localized,
  searchPlaceholder: {
    default: '뷰 검색',
    en: 'Search views',
    'zh-Hans': '搜索视图',
  } satisfies Localized,
  sectionDefault: {
    default: '기본',
    en: 'Default',
    'zh-Hans': '默认',
  } satisfies Localized,
  sectionPrivate: {
    default: '내 뷰',
    en: 'My views',
    'zh-Hans': '我的视图',
  } satisfies Localized,
  sectionShared: {
    default: '공유 뷰',
    en: 'Shared views',
    'zh-Hans': '共享视图',
  } satisfies Localized,
  alwaysVisible: {
    default: '항상 표시',
    en: 'Always shown',
    'zh-Hans': '始终显示',
  } satisfies Localized,
  pin: {
    default: '추가',
    en: 'Add',
    'zh-Hans': '添加',
  } satisfies Localized,
  pinned: {
    default: '꺼냄',
    en: 'On tabs',
    'zh-Hans': '已在标签',
  } satisfies Localized,
  empty: {
    default: '찾는 뷰가 없습니다',
    en: 'No views found',
    'zh-Hans': '未找到视图',
  } satisfies Localized,
  saveCurrent: {
    default: '현재 조건으로 새 뷰 저장',
    en: 'Save current conditions as a new view',
    'zh-Hans': '将当前条件保存为新视图',
  } satisfies Localized,
  newViewName: {
    default: '새 뷰 이름',
    en: 'New view name',
    'zh-Hans': '新视图名称',
  } satisfies Localized,
  viewNamePlaceholder: {
    default: '예: 이번 주 방문',
    en: 'e.g. This week',
    'zh-Hans': '例如：本周',
  } satisfies Localized,
  cancel: {
    default: '취소',
    en: 'Cancel',
    'zh-Hans': '取消',
  } satisfies Localized,
  save: {
    default: '저장',
    en: 'Save',
    'zh-Hans': '保存',
  } satisfies Localized,
}

export function viewDrawerCopy(locale: CollectionLocale) {
  return {
    drawerAria: pickLocalized(M.drawerAria, locale),
    openDrawer: pickLocalized(M.openDrawer, locale),
    searchPlaceholder: pickLocalized(M.searchPlaceholder, locale),
    sectionDefault: pickLocalized(M.sectionDefault, locale),
    sectionPrivate: pickLocalized(M.sectionPrivate, locale),
    sectionShared: pickLocalized(M.sectionShared, locale),
    alwaysVisible: pickLocalized(M.alwaysVisible, locale),
    pin: pickLocalized(M.pin, locale),
    pinned: pickLocalized(M.pinned, locale),
    empty: pickLocalized(M.empty, locale),
    saveCurrent: pickLocalized(M.saveCurrent, locale),
    newViewName: pickLocalized(M.newViewName, locale),
    viewNamePlaceholder: pickLocalized(M.viewNamePlaceholder, locale),
    cancel: pickLocalized(M.cancel, locale),
    save: pickLocalized(M.save, locale),
  }
}
