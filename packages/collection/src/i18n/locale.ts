// 컬렉션 패키지 로캘 — 앱 크롬 i18n(next-intl)과 달리 @mvos/collections 는 독립 패키지(react 만 의존)라
// next-intl 을 쓰지 않는다. 대신 @mvos/design-system·packs 와 동일한 "vocab(로캘별 사전)" 패턴으로, 앱이 현재 로캘을 문자열로
// 주입(CollectionView locale prop)하고 각 뷰가 co-located messages 에서 로캘별 문구를 고른다. 기본은 ko.
//
// 앱의 지원 로캘(@mvos/i18n)과 구조가 갈라지면(한쪽에 로캘 추가 등) 컴파일 타임에 잡히도록, 앱 경계에서
// LocaleParity 가드로 대칭을 강제한다(product 팩과 동형). 여기선 순수 타입/헬퍼만 둔다.
export const COLLECTION_LOCALES = ['ko', 'en', 'zh-Hans'] as const
export type CollectionLocale = (typeof COLLECTION_LOCALES)[number]
export const DEFAULT_COLLECTION_LOCALE: CollectionLocale = 'ko'

/** 임의 문자열을 지원 로캘로 정규화(미지원이면 기본 ko) — 앱에서 넘어온 값을 방어적으로 받는다. */
export function resolveCollectionLocale(value: string | undefined | null): CollectionLocale {
  return (COLLECTION_LOCALES as readonly string[]).includes(value ?? '')
    ? (value as CollectionLocale)
    : DEFAULT_COLLECTION_LOCALE
}

/** 로캘별 값 사전 — 기본(ko) 필수, en·zh-Hans 선택(미제공 시 ko 폴백). vocab 파일이 이 형태로 문구를 담는다. */
export type Localized<T = string> = { default: T } & Partial<Record<CollectionLocale, T>>

/** Localized 값을 로캘로 해석 — 해당 로캘이 없으면 default(ko)로 폴백. */
export function pickLocalized<T>(v: Localized<T>, locale: CollectionLocale): T {
  return locale !== 'ko' && v[locale] !== undefined ? v[locale] : v.default
}
