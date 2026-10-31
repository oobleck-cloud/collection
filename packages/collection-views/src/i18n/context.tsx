'use client'

import { createContext, useContext, type ReactNode } from 'react'

import { DEFAULT_COLLECTION_LOCALE, type CollectionLocale } from '@oobleck/collection'

// 컬렉션 뷰 로캘 컨텍스트 — CollectionView 가 앱에서 받은 locale 을 제공하고, 하위 뷰(TableView·ViewToolbar 등)는
// useCollectionLocale() 로 읽어 co-located messages 를 해석한다. prop drilling(20+ 뷰) 없이 로캘만 흘린다.
// 프로바이더 밖에서 호출해도 기본 ko 로 안전하게 폴백한다(독립 렌더·테스트 무설정 동작 보장).
const CollectionLocaleContext = createContext<CollectionLocale>(DEFAULT_COLLECTION_LOCALE)

export function CollectionLocaleProvider({
  locale,
  children,
}: {
  locale: CollectionLocale
  children: ReactNode
}) {
  return (
    <CollectionLocaleContext.Provider value={locale}>{children}</CollectionLocaleContext.Provider>
  )
}

/** 현재 컬렉션 뷰 로캘(프로바이더 밖이면 ko). 각 뷰가 co-located `xxxCopy(locale)` 에 넘겨 문구를 고른다. */
export function useCollectionLocale(): CollectionLocale {
  return useContext(CollectionLocaleContext)
}
