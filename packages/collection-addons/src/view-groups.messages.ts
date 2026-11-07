import { pickLocalized, type CollectionLocale, type Localized } from '@oobleck/collection'

const M = {
  moveToGroup: {
    default: '그룹으로 이동',
    en: 'Move to group',
    'zh-Hans': '移动到分组',
  } satisfies Localized,
  noGroup: {
    default: '그룹 없음',
    en: 'No group',
    'zh-Hans': '无分组',
  } satisfies Localized,
  newGroupPlaceholder: {
    default: '새 그룹 이름 · Enter',
    en: 'New group name · Enter',
    'zh-Hans': '新分组名称 · Enter',
  } satisfies Localized,
}

export function viewGroupsCopy(locale: CollectionLocale) {
  return {
    moveToGroup: pickLocalized(M.moveToGroup, locale),
    noGroup: pickLocalized(M.noGroup, locale),
    newGroupPlaceholder: pickLocalized(M.newGroupPlaceholder, locale),
  }
}
