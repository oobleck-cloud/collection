import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// ViewTabs 문구(로캘별) — co-located vocab. ko(default)가 기본.
//
// **"탭에서 제거"와 "뷰 삭제"의 문구는 장식이 아니라 안전장치다.** 둘은 결과가 전혀 다른데
// (앞은 내 화면에서만 치우기, 뒤는 뷰 자체를 없애기 — 공유 뷰면 남의 화면에서도) 라벨만으로는
// 구별이 약하다. 그래서 각 항목에 한 줄 설명(caption)을 붙이고, 공유 뷰의 삭제는 라벨 자체에
// "모두에게서"를 적는다.
const M = {
  rename: {
    default: '이름 변경',
    en: 'Rename',
    'zh-Hans': '重命名',
  } satisfies Localized,
  share: {
    default: '전체 공유로 전환',
    en: 'Share with everyone',
    'zh-Hans': '共享给所有人',
  } satisfies Localized,
  duplicateToMine: {
    default: '복제해서 내 뷰로',
    en: 'Duplicate as my view',
    'zh-Hans': '复制为我的视图',
  } satisfies Localized,
  removeFromTabs: {
    default: '탭에서 제거',
    en: 'Remove from tabs',
    'zh-Hans': '从标签中移除',
  } satisfies Localized,
  removeFromTabsCaption: {
    default: '내 화면에서만 치웁니다 · 서랍에 남아 다시 꺼낼 수 있어요',
    en: 'Hides it on your screen only — it stays in the drawer',
    'zh-Hans': '仅在你的屏幕上隐藏 · 仍保留在抽屉中',
  } satisfies Localized,
  deleteView: {
    default: '뷰 삭제',
    en: 'Delete view',
    'zh-Hans': '删除视图',
  } satisfies Localized,
  deleteSharedView: {
    default: '뷰 삭제 · 모두에게서',
    en: 'Delete view · for everyone',
    'zh-Hans': '删除视图 · 对所有人',
  } satisfies Localized,
  deleteViewCaption: {
    default: '뷰 자체가 사라집니다 · 되돌릴 수 없어요',
    en: 'The view itself is gone — this cannot be undone',
    'zh-Hans': '视图本身会消失 · 无法撤销',
  } satisfies Localized,
  deleteSharedViewCaption: {
    default: '공유 뷰라 모두의 화면에서 사라집니다 · 되돌릴 수 없어요',
    en: 'Shared — it disappears for everyone, and cannot be undone',
    'zh-Hans': '共享视图会从所有人的屏幕上消失 · 无法撤销',
  } satisfies Localized,
  viewMenuAria: {
    default: '뷰 메뉴',
    en: 'View menu',
    'zh-Hans': '视图菜单',
  } satisfies Localized,
  defaultViewLocked: {
    default: '기본 뷰 — 항상 첫 자리에 있고 지울 수 없습니다',
    en: 'Default view — always first, cannot be removed',
    'zh-Hans': '默认视图 — 始终排在首位，无法删除',
  } satisfies Localized,
  sharedView: {
    default: '공유 뷰',
    en: 'Shared view',
    'zh-Hans': '共享视图',
  } satisfies Localized,
  bundleViewsAria: {
    default: '묶음의 뷰',
    en: 'Views in bundle',
    'zh-Hans': '分组中的视图',
  } satisfies Localized,
}

export function viewTabsCopy(locale: CollectionLocale) {
  return {
    rename: pickLocalized(M.rename, locale),
    share: pickLocalized(M.share, locale),
    duplicateToMine: pickLocalized(M.duplicateToMine, locale),
    removeFromTabs: pickLocalized(M.removeFromTabs, locale),
    removeFromTabsCaption: pickLocalized(M.removeFromTabsCaption, locale),
    deleteView: pickLocalized(M.deleteView, locale),
    deleteSharedView: pickLocalized(M.deleteSharedView, locale),
    deleteViewCaption: pickLocalized(M.deleteViewCaption, locale),
    deleteSharedViewCaption: pickLocalized(M.deleteSharedViewCaption, locale),
    viewMenuAria: pickLocalized(M.viewMenuAria, locale),
    defaultViewLocked: pickLocalized(M.defaultViewLocked, locale),
    sharedView: pickLocalized(M.sharedView, locale),
    bundleViewsAria: pickLocalized(M.bundleViewsAria, locale),
  }
}
