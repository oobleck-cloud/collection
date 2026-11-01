// @oobleck/collection-views-workstyle — Workstyle 킷: 컬렉션 뷰의 부품 자리(@oobleck/collection-views/kit)를 @oobleck/workstyle/react 로 채운다.
// collection-views 본체가 workstyle 을 의존하지 않게 따로 둔 패키지다(MVOS 처럼 systheme 만 쓰는 앱은 받지 않는다).
// systheme 과 같은 props 를 받아 Workstyle 부품으로 옮긴다.
//   <KitProvider kit={workstyleKit}> … </KitProvider>  (스타일: 앱이 '@oobleck/workstyle/react.css' 를 한 번 불러온다)
// 이 킷이 채우지 않는 자리(AnchorContextSurface·MultiSelect·TagSelect·DateEditPanel·표·지도 등)와 아이콘은 systheme 이 그린다.
// 감싼 부분과 systheme 패널을 붙일 상자에 .dark 를 걸어 systheme 의 다크 값(Workstyle 색과 같게 맞춰 둠)이 그 안의 Tailwind 색에도 걸린다.
import {
  Avatar as WsAvatar,
  Badge as WsBadge,
  Button as WsButton,
  Checkbox as WsCheckbox,
  EmptyState as WsEmptyState,
  Field,
  Float,
  Icon,
  Input as WsInput,
  Loader,
  Select as WsSelect,
  Switch as WsSwitch,
  Tooltip as WsTooltip,
  cx,
  type BadgeTone,
  type ButtonKind,
  type FloatPlace,
  type IconName,
} from '@oobleck/workstyle/react'
import { PortalRootProvider } from '@oobleck/systheme'
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import type { IconSlotName, Kit } from '@oobleck/collection-views/kit'

type AnyProps = Record<string, any>

const KIND: Record<string, ButtonKind> = {
  primary: 'primary',
  secondary: 'secondary',
  tonal: 'secondary',
  outline: 'secondary',
  ghost: 'ghost',
  destructive: 'danger',
}

const Button = forwardRef<HTMLButtonElement, AnyProps>(function WorkstyleButton(
  {
    variant = 'primary',
    size = 'md',
    isLoading,
    density: _density,
    round: _round,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  const icon = size === 'icon'
  return (
    <WsButton
      ref={ref}
      kind={KIND[variant] ?? 'secondary'}
      size={icon ? 'md' : size}
      className={cx(icon && 'ws-icon', className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading && <Loader />}
      {children}
    </WsButton>
  )
})

const Input = forwardRef<HTMLInputElement, AnyProps>(function WorkstyleInput(
  {
    size,
    prefix,
    suffix,
    value,
    defaultValue,
    onValueChange,
    onBlurValue,
    validate,
    onValidityChange,
    onEnterKey,
    onEscapeKey,
    onKeyDown,
    chrome: _chrome,
    variant: _variant,
    label,
    className,
    ...rest
  },
  ref,
) {
  const [inner, setInner] = useState<string>(defaultValue ?? '')
  const [error, setError] = useState<string | undefined>()
  const current = value ?? inner
  const props = {
    ...rest,
    'aria-label': rest['aria-label'] ?? (typeof label === 'string' ? label : undefined),
    'aria-invalid': error ? ('true' as const) : undefined,
    value: current,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      if (value === undefined) setInner(v)
      onValueChange?.(v)
      if (validate) {
        const m = validate(v)
        setError(m)
        onValidityChange?.(m)
      }
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => onBlurValue?.(e.target.value),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      onKeyDown?.(e)
      if (e.defaultPrevented || e.nativeEvent.isComposing) return
      if (e.key === 'Enter') onEnterKey?.()
      else if (e.key === 'Escape') onEscapeKey?.()
    },
  }
  if (prefix || suffix)
    return (
      <Field
        ref={ref}
        prefix={prefix}
        suffix={suffix}
        fieldClassName={cx(size === 'lg' && 'ws-lg', className)}
        {...props}
      />
    )
  return <WsInput ref={ref} size={size === 'lg' ? 'lg' : 'md'} className={className} {...props} />
})

function Select({ options, label, hint: _hint, ...rest }: AnyProps) {
  return (
    <WsSelect
      options={(options ?? []).map((o: AnyProps) => ({
        value: o.value,
        label: o.label,
        disabled: o.disabled,
        desc: o.hint,
        keywords: o.keywords,
      }))}
      aria-label={rest['aria-label'] ?? (typeof label === 'string' ? label : undefined)}
      {...rest}
    />
  )
}

const PLACE: Record<string, Record<string, FloatPlace>> = {
  bottom: { start: 'bottom-start', center: 'bottom-center', end: 'bottom-end' },
  top: { start: 'top-start', center: 'top-center', end: 'top-end' },
  right: { start: 'right-start', center: 'right-start', end: 'right-start' },
  left: { start: 'right-start', center: 'right-start', end: 'right-start' },
}

function Popover({
  trigger,
  children,
  open: controlled,
  onOpenChange,
  defaultOpen = false,
  side = 'bottom',
  align = 'start',
  showDismiss: _showDismiss,
  className,
  triggerClassName,
  contentClassName,
}: AnyProps) {
  const [inner, setInner] = useState<boolean>(defaultOpen)
  const open = controlled ?? inner
  const setOpen = (v: boolean) => {
    if (controlled === undefined) setInner(v)
    onOpenChange?.(v)
  }
  const anchor = useRef<HTMLSpanElement | null>(null)
  const id = useId()
  const triggerProps = {
    onClick: () => setOpen(!open),
    'aria-expanded': open,
    'aria-controls': open ? id : undefined,
    'aria-haspopup': 'dialog' as const,
  }
  return (
    <span
      ref={anchor}
      className={cx(className, triggerClassName)}
      style={{ display: 'inline-flex' }}
    >
      {typeof trigger === 'function' ? (
        trigger(triggerProps)
      ) : (
        // systheme Popover 와 같이 감싼 것을 단추 역할로(Enter·Space 로도 연다)
        <span
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={triggerProps.onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(!open)
            }
          }}
        >
          {trigger}
        </span>
      )}
      {open && (
        <Float
          anchor={anchor.current}
          place={PLACE[side]?.[align] ?? 'bottom-start'}
          onClose={() => setOpen(false)}
        >
          <div id={id} role="dialog" className={cx('ws-popover dark', contentClassName)}>
            {children}
          </div>
        </Float>
      )}
    </span>
  )
}

function Switch({ checked, defaultChecked, onCheckedChange, label, ...rest }: AnyProps) {
  const [inner, setInner] = useState<boolean>(!!defaultChecked)
  const on = checked ?? inner
  const sw = (
    <WsSwitch
      checked={on}
      onCheckedChange={(v) => {
        if (checked === undefined) setInner(v)
        onCheckedChange?.(v)
      }}
      label={typeof label === 'string' ? label : undefined}
      {...rest}
    />
  )
  return label && typeof label !== 'string' ? (
    <label className="ws-row">
      {sw}
      {label}
    </label>
  ) : (
    sw
  )
}

function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  label,
  description,
  indeterminate,
  size: _size,
  className,
  ...rest
}: AnyProps) {
  const [inner, setInner] = useState<boolean>(!!defaultChecked)
  const on = checked ?? inner
  const box = (
    <WsCheckbox
      checked={!!on}
      indeterminate={indeterminate}
      label={typeof label === 'string' ? label : undefined}
      onCheckedChange={(v) => {
        if (checked === undefined) setInner(v)
        onCheckedChange?.(v)
      }}
      className={label || description ? undefined : className}
      {...rest}
    />
  )
  if (!label && !description) return box
  return (
    <label className={cx('ws-row', className)} style={{ alignItems: 'flex-start' }}>
      {box}
      <span className="ws-stack">
        {label}
        {description && <span className="ws-hint">{description}</span>}
      </span>
    </label>
  )
}

function Tooltip({ content, children, side, delayDuration }: AnyProps) {
  return (
    <WsTooltip content={content} side={side} delay={delayDuration}>
      {children}
    </WsTooltip>
  )
}

const TONE: Record<string, BadgeTone> = {
  primary: 'acc',
  info: 'acc',
  'outline-primary': 'acc',
  success: 'ok',
  'outline-success': 'ok',
  warning: 'warn',
  'outline-warning': 'warn',
  error: 'bad',
  'outline-error': 'bad',
}

function Badge({ variant = 'default', size: _size, className, children, ...rest }: AnyProps) {
  return (
    <span {...rest} style={{ display: 'contents' }}>
      <WsBadge tone={TONE[variant] ?? 'default'} className={className}>
        {children}
      </WsBadge>
    </span>
  )
}

function Avatar({ name, src, className }: AnyProps) {
  return <WsAvatar name={name} src={src} className={className} />
}

function Spinner({ className }: AnyProps) {
  // systheme Spinner 처럼 장식만(상태 알림은 감싼 쪽 role="status" 가 한다)
  return (
    <span className={cx('ws-loader', className)} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

function EmptyState({
  title,
  message,
  illustration,
  primaryAction,
  secondaryAction,
  className,
}: AnyProps) {
  return (
    <WsEmptyState
      className={className}
      title={
        <>
          {illustration && (
            <span className="ws-ic" style={{ justifyContent: 'center', marginBottom: 4 }}>
              {illustration}
            </span>
          )}
          {title}
        </>
      }
      description={message}
      action={
        (primaryAction || secondaryAction) && (
          <div className="ws-row" style={{ justifyContent: 'center', marginTop: 6 }}>
            {secondaryAction}
            {primaryAction}
          </div>
        )
      }
    />
  )
}

/** lucide 이름 → Workstyle 아이콘. 없는 모양은 systheme(lucide) 으로 둔다 */
export const WORKSTYLE_ICONS: { [K in IconSlotName]?: IconName } = {
  Check: 'check',
  ChevronDown: 'chevron-down',
  ChevronRight: 'chevron-right',
  Copy: 'copy',
  EyeOff: 'eye-off',
  FileText: 'file',
  LayoutDashboard: 'layout',
  Link2: 'link',
  List: 'list',
  Lock: 'lock',
  Map: 'map',
  MapPin: 'pin',
  MoreHorizontal: 'more',
  MousePointerClick: 'cursor',
  PanelRight: 'panel-right',
  Pencil: 'pen',
  Plus: 'plus',
  Search: 'search',
  Settings: 'settings',
  SlidersHorizontal: 'sliders',
  Trash2: 'trash',
  TriangleAlert: 'warn',
  User: 'person',
  Users: 'users',
  X: 'close',
}

function wsIcon(name: IconName): ComponentType<any> {
  const C = forwardRef<HTMLSpanElement, AnyProps>(function WorkstyleIcon(
    { size, className, strokeWidth: _sw, absoluteStrokeWidth: _a, color: _c, ...rest },
    ref,
  ) {
    return (
      <span ref={ref} {...rest} style={{ display: 'contents' }}>
        <Icon name={name} size={typeof size === 'number' ? size : 16} className={className} />
      </span>
    )
  })
  C.displayName = `WorkstyleIcon(${name})`
  return C
}

// 감싼 곳과, systheme 이 띄우는 패널(메뉴·고르개·툴팁 …)을 붙일 body 아래 상자에 .dark 를 건다.
// 패널은 body 로 나가 감싼 곳의 .dark 밖이 되므로 PortalRootProvider 로 그 상자에 붙게 한다(fixed 라 자리는 같다).
function Root({ children }: { children: ReactNode }) {
  const [box, setBox] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const el = document.createElement('div')
    el.className = 'dark ws-scope'
    el.dataset.kitPortal = 'workstyle'
    document.body.appendChild(el)
    setBox(el)
    return () => el.remove()
  }, [])
  return (
    <div className="dark ws-scope" data-kit="workstyle" style={{ display: 'contents' }}>
      <PortalRootProvider container={box}>{children}</PortalRootProvider>
    </div>
  )
}

export const workstyleKit: Kit = {
  name: 'workstyle',
  Root,
  components: {
    Button,
    Input,
    Select,
    Popover,
    Switch,
    Checkbox,
    Tooltip,
    Badge,
    Avatar,
    Spinner,
    EmptyState,
  },
  icons: Object.fromEntries(
    Object.entries(WORKSTYLE_ICONS).map(([k, v]) => [k, wsIcon(v as IconName)]),
  ),
}
