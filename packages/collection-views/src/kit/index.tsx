// 부품 자리(슬롯). 컬렉션 뷰는 화면 부품을 '@oobleck/systheme' 에서 바로 가져오지 않고 여기서 가져온다.
// 기본은 systheme 그대로라 MVOS 화면은 바뀌지 않는다. <KitProvider kit={workstyleKit}> 처럼 감싸면 그 아래 자리만 다른 킷으로 채운다.
// 킷에 없는 자리는 바깥 KitProvider, 그다음 systheme 으로 넘어간다(부분 킷 가능).
// systheme 은 그리는 때에 읽는다: 시험이 systheme 을 일부만 흉내 내도(vi.mock) 쓰지 않는 자리 때문에 깨지지 않게.
import * as Systheme from '@oobleck/systheme'
import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  type ComponentType,
  type ReactNode,
} from 'react'

export * from '@oobleck/systheme'

/** 바꿔 끼울 수 있는 부품. 값은 systheme 과 같은 props 를 받아야 한다 */
export const SLOT_NAMES = [
  'Button',
  'Input',
  'Select',
  'Popover',
  'Switch',
  'Checkbox',
  'Tooltip',
  'Badge',
  'Avatar',
  'Spinner',
  'EmptyState',
] as const
export type SlotName = (typeof SLOT_NAMES)[number]

/** 바꿔 끼울 수 있는 아이콘(lucide 이름). 값은 LucideIcon 처럼 className·size·aria-* 를 받는다 */
export const ICON_SLOT_NAMES = [
  'ArrowDown',
  'ArrowLeftRight',
  'ArrowUp',
  'CalendarDays',
  'Check',
  'ChevronDown',
  'ChevronLeft',
  'ChevronRight',
  'ChevronsLeft',
  'ChevronsRight',
  'ClipboardList',
  'Copy',
  'EyeOff',
  'FileText',
  'Hash',
  'LayoutDashboard',
  'Link2',
  'List',
  'Lock',
  'Mail',
  'Map',
  'MapPin',
  'MessageSquare',
  'Monitor',
  'MoreHorizontal',
  'MousePointerClick',
  'PanelRight',
  'Pencil',
  'Phone',
  'Plus',
  'Search',
  'Settings',
  'SlidersHorizontal',
  'SquareCheck',
  'Tags',
  'Trash2',
  'TriangleAlert',
  'Type',
  'User',
  'Users',
  'X',
] as const
export type IconSlotName = (typeof ICON_SLOT_NAMES)[number]

export type Kit = {
  /** 이름(시험·디버그용) */
  name?: string
  components?: { [K in SlotName]?: ComponentType<any> }
  icons?: { [K in IconSlotName]?: ComponentType<any> }
  /** 감싼 부분 바깥에 둘 것(테마 클래스 등). 없으면 children 그대로 */
  Root?: ComponentType<{ children: ReactNode }>
}

type Resolved = {
  components: NonNullable<Kit['components']>
  icons: NonNullable<Kit['icons']>
  names: string[]
}
const KitContext = createContext<Resolved>({ components: {}, icons: {}, names: [] })

/** 아래 부품 자리를 kit 으로 채운다. 겹쳐 쓰면 안쪽이 먼저, 빈 자리는 바깥 것 */
export function KitProvider({ kit, children }: { kit: Kit; children: ReactNode }) {
  const outer = useContext(KitContext)
  const value = useMemo<Resolved>(
    () => ({
      components: { ...outer.components, ...kit.components },
      icons: { ...outer.icons, ...kit.icons },
      names: kit.name ? [...outer.names, kit.name] : outer.names,
    }),
    [outer, kit],
  )
  const Root = kit.Root
  return (
    <KitContext.Provider value={value}>
      {Root ? <Root>{children}</Root> : children}
    </KitContext.Provider>
  )
}

/** 지금 자리에 걸린 킷 이름들(바깥 → 안) */
export function useKitNames(): string[] {
  return useContext(KitContext).names
}

const fallback = (name: string): ComponentType<any> =>
  (Systheme as Record<string, unknown>)[name] as ComponentType<any>

function slot<T>(name: SlotName): T {
  const C = forwardRef<unknown, Record<string, unknown>>(function Slot(props, ref) {
    const Impl = useContext(KitContext).components[name] ?? fallback(name)
    // ref 는 받은 때만 넘긴다: React 19 는 ref 를 props 로도 주므로 ref={null} 이 킷 부품 안의 제 ref 를 덮지 않게
    return ref ? <Impl ref={ref} {...props} /> : <Impl {...props} />
  })
  C.displayName = `Slot(${name})`
  return C as unknown as T
}

function iconSlot<T>(name: IconSlotName): T {
  const C = forwardRef<unknown, Record<string, unknown>>(function IconSlot(props, ref) {
    const Impl = useContext(KitContext).icons[name] ?? fallback(name)
    return ref ? <Impl ref={ref} {...props} /> : <Impl {...props} />
  })
  C.displayName = `Icon(${name})`
  return C as unknown as T
}

type S = typeof Systheme

export const Button = slot<S['Button']>('Button')
export const Input = slot<S['Input']>('Input')
export const Select = slot<S['Select']>('Select')
export const Popover = slot<S['Popover']>('Popover')
export const Switch = slot<S['Switch']>('Switch')
export const Checkbox = slot<S['Checkbox']>('Checkbox')
export const Tooltip = slot<S['Tooltip']>('Tooltip')
export const Badge = slot<S['Badge']>('Badge')
export const Avatar = slot<S['Avatar']>('Avatar')
export const Spinner = slot<S['Spinner']>('Spinner')
export const EmptyState = slot<S['EmptyState']>('EmptyState')

export const ArrowDown = iconSlot<S['ArrowDown']>('ArrowDown')
export const ArrowLeftRight = iconSlot<S['ArrowLeftRight']>('ArrowLeftRight')
export const ArrowUp = iconSlot<S['ArrowUp']>('ArrowUp')
export const CalendarDays = iconSlot<S['CalendarDays']>('CalendarDays')
export const Check = iconSlot<S['Check']>('Check')
export const ChevronDown = iconSlot<S['ChevronDown']>('ChevronDown')
export const ChevronLeft = iconSlot<S['ChevronLeft']>('ChevronLeft')
export const ChevronRight = iconSlot<S['ChevronRight']>('ChevronRight')
export const ChevronsLeft = iconSlot<S['ChevronsLeft']>('ChevronsLeft')
export const ChevronsRight = iconSlot<S['ChevronsRight']>('ChevronsRight')
export const ClipboardList = iconSlot<S['ClipboardList']>('ClipboardList')
export const Copy = iconSlot<S['Copy']>('Copy')
export const EyeOff = iconSlot<S['EyeOff']>('EyeOff')
export const FileText = iconSlot<S['FileText']>('FileText')
export const Hash = iconSlot<S['Hash']>('Hash')
export const LayoutDashboard = iconSlot<S['LayoutDashboard']>('LayoutDashboard')
export const Link2 = iconSlot<S['Link2']>('Link2')
export const List = iconSlot<S['List']>('List')
export const Lock = iconSlot<S['Lock']>('Lock')
export const Mail = iconSlot<S['Mail']>('Mail')
export const Map = iconSlot<S['Map']>('Map')
export const MapPin = iconSlot<S['MapPin']>('MapPin')
export const MessageSquare = iconSlot<S['MessageSquare']>('MessageSquare')
export const Monitor = iconSlot<S['Monitor']>('Monitor')
export const MoreHorizontal = iconSlot<S['MoreHorizontal']>('MoreHorizontal')
export const MousePointerClick = iconSlot<S['MousePointerClick']>('MousePointerClick')
export const PanelRight = iconSlot<S['PanelRight']>('PanelRight')
export const Pencil = iconSlot<S['Pencil']>('Pencil')
export const Phone = iconSlot<S['Phone']>('Phone')
export const Plus = iconSlot<S['Plus']>('Plus')
export const Search = iconSlot<S['Search']>('Search')
export const Settings = iconSlot<S['Settings']>('Settings')
export const SlidersHorizontal = iconSlot<S['SlidersHorizontal']>('SlidersHorizontal')
export const SquareCheck = iconSlot<S['SquareCheck']>('SquareCheck')
export const Tags = iconSlot<S['Tags']>('Tags')
export const Trash2 = iconSlot<S['Trash2']>('Trash2')
export const TriangleAlert = iconSlot<S['TriangleAlert']>('TriangleAlert')
export const Type = iconSlot<S['Type']>('Type')
export const User = iconSlot<S['User']>('User')
export const Users = iconSlot<S['Users']>('Users')
export const X = iconSlot<S['X']>('X')
