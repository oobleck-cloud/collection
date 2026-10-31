import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// ProjectedPeekPanel 문구(로캘별) — co-located vocab(collections L1 은 next-intl 이 아니라 vocab i18n).
// ko(default)는 워크스페이스 PeekPanel(messages/peek.*)의 대응 문구와 파리티, en·zh-Hans 는 관용 번역.

const M = {
  panelLabelFallback: {
    default: '레코드 미리보기',
    en: 'Record preview',
    'zh-Hans': '记录预览',
  } satisfies Localized,
  openSide: {
    default: '사이드 패널로 열기',
    en: 'Open in side panel',
    'zh-Hans': '在侧栏中打开',
  } satisfies Localized,
  openCenter: {
    default: '모달(중앙)로 열기',
    en: 'Open as centered modal',
    'zh-Hans': '以居中模态框打开',
  } satisfies Localized,
  close: { default: '닫기', en: 'Close', 'zh-Hans': '关闭' } satisfies Localized,
}

export function projectedPeekCopy(locale: CollectionLocale) {
  return {
    panelLabelFallback: pickLocalized(M.panelLabelFallback, locale),
    openSide: pickLocalized(M.openSide, locale),
    openCenter: pickLocalized(M.openCenter, locale),
    close: pickLocalized(M.close, locale),
  }
}
