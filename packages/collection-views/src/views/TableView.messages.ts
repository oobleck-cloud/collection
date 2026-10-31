import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// TableView 문구(로캘별) — co-located vocab 패턴. ko(default)는 기존 하드코딩과 바이트 동일(파리티),
// en·zh-Hans 는 관용 번역. 셀·헤더 메뉴·타입 피커·집계 푸터 등 표 UI 전반의 사용자 노출 문자열.
const M = {
  selectPlaceholder: { default: '선택', en: 'Select', 'zh-Hans': '选择' } satisfies Localized,
  inputPlaceholder: { default: '입력', en: 'Enter', 'zh-Hans': '输入' } satisfies Localized,
  cellEditAria: {
    default: '셀 편집',
    en: 'Edit cell',
    'zh-Hans': '编辑单元格',
  } satisfies Localized,
  numberPlaceholder: { default: '숫자', en: 'Number', 'zh-Hans': '数字' } satisfies Localized,
  numberCellEditAria: {
    default: '숫자 셀 편집',
    en: 'Edit number cell',
    'zh-Hans': '编辑数字单元格',
  } satisfies Localized,
  untitled: { default: '제목 없음', en: 'Untitled', 'zh-Hans': '无标题' } satisfies Localized,
  titleAria: { default: '제목', en: 'Title', 'zh-Hans': '标题' } satisfies Localized,
  open: { default: '열기', en: 'Open', 'zh-Hans': '打开' } satisfies Localized,
  addTagPlaceholder: {
    default: '태그 추가',
    en: 'Add tag',
    'zh-Hans': '添加标签',
  } satisfies Localized,
  inheritedLockedAria: {
    default: '프로토타입(Form) 상속 컬럼 — 구조 잠김',
    en: 'Prototype (Form) inherited column — structure locked',
    'zh-Hans': '原型（Form）继承列 — 结构已锁定',
  } satisfies Localized,
  moveColumnAria: {
    default: '컬럼 이동',
    en: 'Move column',
    'zh-Hans': '移动列',
  } satisfies Localized,
  changeType: {
    default: '유형 변경',
    en: 'Change type',
    'zh-Hans': '更改类型',
  } satisfies Localized,
  selectType: {
    default: '유형 선택',
    en: 'Select type',
    'zh-Hans': '选择类型',
  } satisfies Localized,
  columnOptions: {
    default: '{label} 열 옵션',
    en: '{label} column options',
    'zh-Hans': '{label} 列选项',
  } satisfies Localized,
  rename: { default: '이름 변경', en: 'Rename', 'zh-Hans': '重命名' } satisfies Localized,
  optionColors: {
    default: '선택지 색',
    en: 'Option colors',
    'zh-Hans': '选项颜色',
  } satisfies Localized,
  optionColorsHint: {
    default: '팀 전체에 적용돼요',
    en: 'Applies to the whole team',
    'zh-Hans': '对整个团队生效',
  } satisfies Localized,
  optionColorAria: {
    default: '{label} 색 바꾸기',
    en: 'Change {label} color',
    'zh-Hans': '更改 {label} 颜色',
  } satisfies Localized,
  colorDefault: { default: '기본', en: 'Default', 'zh-Hans': '默认' } satisfies Localized,
  colorGray: { default: '회색', en: 'Gray', 'zh-Hans': '灰色' } satisfies Localized,
  colorBlue: { default: '파랑', en: 'Blue', 'zh-Hans': '蓝色' } satisfies Localized,
  colorGreen: { default: '초록', en: 'Green', 'zh-Hans': '绿色' } satisfies Localized,
  colorOrange: { default: '주황', en: 'Orange', 'zh-Hans': '橙色' } satisfies Localized,
  colorRed: { default: '빨강', en: 'Red', 'zh-Hans': '红色' } satisfies Localized,
  colorPurple: { default: '보라', en: 'Purple', 'zh-Hans': '紫色' } satisfies Localized,
  colorTeal: { default: '청록', en: 'Teal', 'zh-Hans': '青色' } satisfies Localized,
  unsetInherited: {
    default: '상속(Form) 해제',
    en: 'Remove inheritance (Form)',
    'zh-Hans': '取消继承（Form）',
  } satisfies Localized,
  setInherited: {
    default: '상속(Form) 컬럼으로',
    en: 'Make inherited (Form) column',
    'zh-Hans': '设为继承（Form）列',
  } satisfies Localized,
  sortAsc: { default: '오름차순', en: 'Ascending', 'zh-Hans': '升序' } satisfies Localized,
  sortDesc: { default: '내림차순', en: 'Descending', 'zh-Hans': '降序' } satisfies Localized,
  clearSort: { default: '정렬 해제', en: 'Clear sort', 'zh-Hans': '取消排序' } satisfies Localized,
  hide: { default: '숨기기', en: 'Hide', 'zh-Hans': '隐藏' } satisfies Localized,
  deleteProperty: {
    default: '속성 삭제',
    en: 'Delete property',
    'zh-Hans': '删除属性',
  } satisfies Localized,
  aggregationMethod: {
    default: '집계 방식',
    en: 'Aggregation',
    'zh-Hans': '汇总方式',
  } satisfies Localized,
  calculate: { default: '계산', en: 'Calculate', 'zh-Hans': '计算' } satisfies Localized,
  /** 서버 페이지네이션 목록의 집계 범위 표시 — 전체가 아니라 이 페이지만 셌음을 밝힌다. */
  scopePage: { default: '(이 페이지)', en: '(this page)', 'zh-Hans': '(本页)' } satisfies Localized,
  linkTarget: {
    default: '연결 대상',
    en: 'Link target',
    'zh-Hans': '关联对象',
  } satisfies Localized,
  singleRef: { default: '단일 참조', en: 'Single', 'zh-Hans': '单个' } satisfies Localized,
  multiRef: { default: '다중 참조', en: 'Multiple', 'zh-Hans': '多个' } satisfies Localized,
  singlePerson: { default: '한 명', en: 'One person', 'zh-Hans': '一人' } satisfies Localized,
  multiPerson: { default: '여러 명', en: 'Multiple people', 'zh-Hans': '多人' } satisfies Localized,
  addPropertyDialog: {
    default: '새 속성 추가',
    en: 'Add property',
    'zh-Hans': '添加属性',
  } satisfies Localized,
  addProperty: {
    default: '속성 추가',
    en: 'Add property',
    'zh-Hans': '添加属性',
  } satisfies Localized,
  propertyName: {
    default: '속성 이름',
    en: 'Property name',
    'zh-Hans': '属性名称',
  } satisfies Localized,
  nameInputPlaceholder: {
    default: '이름 입력...',
    en: 'Enter name…',
    'zh-Hans': '输入名称…',
  } satisfies Localized,
  toAddSuffix: { default: '로 추가', en: 'to add', 'zh-Hans': '添加' } satisfies Localized,
  cancel: { default: '취소', en: 'Cancel', 'zh-Hans': '取消' } satisfies Localized,
  add: { default: '추가', en: 'Add', 'zh-Hans': '添加' } satisfies Localized,
  moveRowAria: { default: '행 이동', en: 'Move row', 'zh-Hans': '移动行' } satisfies Localized,
  selectRowAria: { default: '행 선택', en: 'Select row', 'zh-Hans': '选择行' } satisfies Localized,
  selectAllRowsAria: {
    default: '보이는 행 모두 선택',
    en: 'Select all visible rows',
    'zh-Hans': '选择所有可见行',
  } satisfies Localized,
  resizeColumnAria: {
    default: '컬럼 폭 조정',
    en: 'Resize column',
    'zh-Hans': '调整列宽',
  } satisfies Localized,
  createDefault: {
    default: '+ 새 항목',
    en: '+ New item',
    'zh-Hans': '+ 新建项',
  } satisfies Localized,
} as const

// 타입 피커 그룹 라벨(기본/연락처/고급).
const GROUP: Record<string, Localized> = {
  basic: { default: '기본', en: 'Basic', 'zh-Hans': '基础' },
  contact: { default: '연락처', en: 'Contact', 'zh-Hans': '联系方式' },
  advanced: { default: '고급', en: 'Advanced', 'zh-Hans': '高级' },
}

// PropertyType 별 라벨(타입 피커·유형 변경 서브메뉴 공용).
const TYPE_LABEL: Record<string, Localized> = {
  text: { default: '텍스트', en: 'Text', 'zh-Hans': '文本' },
  number: { default: '숫자', en: 'Number', 'zh-Hans': '数字' },
  select: { default: '선택', en: 'Select', 'zh-Hans': '选择' },
  multi_select: { default: '다중선택', en: 'Multi-select', 'zh-Hans': '多选' },
  date: { default: '날짜', en: 'Date', 'zh-Hans': '日期' },
  checkbox: { default: '체크박스', en: 'Checkbox', 'zh-Hans': '复选框' },
  url: { default: 'URL', en: 'URL', 'zh-Hans': 'URL' },
  email: { default: '이메일', en: 'Email', 'zh-Hans': '邮箱' },
  phone: { default: '전화번호', en: 'Phone', 'zh-Hans': '电话' },
  relation: { default: '관계', en: 'Relation', 'zh-Hans': '关系' },
  geo: { default: '위치', en: 'Location', 'zh-Hans': '位置' },
  person: { default: '사람', en: 'Person', 'zh-Hans': '人员' },
  multi_person: { default: '사람(여러 명)', en: 'People', 'zh-Hans': '多人' },
  struct: { default: '구조', en: 'Structure', 'zh-Hans': '结构' },
}

// PropertyType 별 설명(타입 피커의 보조 문구).
const TYPE_DESCRIPTION: Record<string, Localized> = {
  text: { default: '자유 입력 문자열', en: 'Free-form text', 'zh-Hans': '自由文本' },
  number: { default: '정수·소수 값', en: 'Integer or decimal', 'zh-Hans': '整数或小数' },
  select: { default: '하나의 태그 선택', en: 'Pick one tag', 'zh-Hans': '选择一个标签' },
  multi_select: { default: '여러 태그 선택', en: 'Pick multiple tags', 'zh-Hans': '选择多个标签' },
  date: { default: '날짜 값', en: 'Date value', 'zh-Hans': '日期值' },
  checkbox: { default: '참/거짓 토글', en: 'True/false toggle', 'zh-Hans': '真/假开关' },
  url: { default: '링크 주소', en: 'Link address', 'zh-Hans': '链接地址' },
  email: { default: '이메일 주소', en: 'Email address', 'zh-Hans': '电子邮件地址' },
  phone: { default: '전화번호', en: 'Phone number', 'zh-Hans': '电话号码' },
  relation: {
    default: '다른 컬렉션 연결',
    en: 'Link to another collection',
    'zh-Hans': '关联其他集合',
  },
  geo: {
    default: '경위도 + 도로명주소',
    en: 'Coordinates + street address',
    'zh-Hans': '经纬度 + 街道地址',
  },
  person: {
    default: '등록된 계정에서 고르기',
    en: 'Pick from registered accounts',
    'zh-Hans': '从已注册账号中选择',
  },
  struct: {
    default: '다른 속성을 비교 · 범위 · 경로로 묶기',
    en: 'Group other properties as compare · range · route',
    'zh-Hans': '将其他属性组合为对比 · 范围 · 路线',
  },
}

const STRUCT_COPY = {
  structNextStep: {
    default: '추가하면 칸과 배치를 고르는 창이 열립니다.',
    en: 'After adding, choose slots and layout.',
    'zh-Hans': '添加后选择槽位和布局。',
  },
  configureStruct: {
    default: '칸 · 배치 편집',
    en: 'Edit slots · layout',
    'zh-Hans': '编辑槽位 · 布局',
  },
  configureUnit: { default: '단위', en: 'Unit', 'zh-Hans': '单位' },
  manwonSuspect: {
    default:
      '이 칸은 만 원 단위입니다. 원으로 적으셨다면 {value}으로 적을까요?\n(취소하면 적은 그대로 둡니다)',
    en: 'This field is in 10,000 KRW. Save as {value}?\n(Cancel keeps the typed value)',
    'zh-Hans': '此字段以万韩元为单位。保存为 {value}？\n(取消则保留输入值)',
  },
} satisfies Record<string, Localized>

const COLOR_NAME: Record<string, Localized> = {
  gray: M.colorGray,
  blue: M.colorBlue,
  green: M.colorGreen,
  orange: M.colorOrange,
  red: M.colorRed,
  purple: M.colorPurple,
  teal: M.colorTeal,
}

export function tableViewCopy(locale: CollectionLocale) {
  const p = (m: Localized) => pickLocalized(m, locale)
  return {
    structNextStep: p(STRUCT_COPY.structNextStep),
    configureStruct: p(STRUCT_COPY.configureStruct),
    configureUnit: p(STRUCT_COPY.configureUnit),
    manwonSuspect: (value: string) => p(STRUCT_COPY.manwonSuspect).replace('{value}', value),
    selectPlaceholder: p(M.selectPlaceholder),
    inputPlaceholder: p(M.inputPlaceholder),
    cellEditAria: p(M.cellEditAria),
    numberPlaceholder: p(M.numberPlaceholder),
    numberCellEditAria: p(M.numberCellEditAria),
    untitled: p(M.untitled),
    titleAria: p(M.titleAria),
    open: p(M.open),
    addTagPlaceholder: p(M.addTagPlaceholder),
    inheritedLockedAria: p(M.inheritedLockedAria),
    moveColumnAria: p(M.moveColumnAria),
    changeType: p(M.changeType),
    selectType: p(M.selectType),
    columnOptions: (label: string) => p(M.columnOptions).replace('{label}', label),
    rename: p(M.rename),
    optionColors: p(M.optionColors),
    optionColorsHint: p(M.optionColorsHint),
    optionColorAria: (label: string) => p(M.optionColorAria).replace('{label}', label),
    colorDefault: p(M.colorDefault),
    colorName: (color: string) => (COLOR_NAME[color] ? p(COLOR_NAME[color]) : color),
    unsetInherited: p(M.unsetInherited),
    setInherited: p(M.setInherited),
    sortAsc: p(M.sortAsc),
    sortDesc: p(M.sortDesc),
    clearSort: p(M.clearSort),
    hide: p(M.hide),
    deleteProperty: p(M.deleteProperty),
    aggregationMethod: p(M.aggregationMethod),
    calculate: p(M.calculate),
    scopePage: p(M.scopePage),
    linkTarget: p(M.linkTarget),
    singleRef: p(M.singleRef),
    multiRef: p(M.multiRef),
    singlePerson: p(M.singlePerson),
    multiPerson: p(M.multiPerson),
    addPropertyDialog: p(M.addPropertyDialog),
    addProperty: p(M.addProperty),
    propertyName: p(M.propertyName),
    nameInputPlaceholder: p(M.nameInputPlaceholder),
    toAddSuffix: p(M.toAddSuffix),
    cancel: p(M.cancel),
    add: p(M.add),
    moveRowAria: p(M.moveRowAria),
    selectRowAria: p(M.selectRowAria),
    selectAllRowsAria: p(M.selectAllRowsAria),
    resizeColumnAria: p(M.resizeColumnAria),
    createDefault: p(M.createDefault),
    groupLabel: (group: string) => (GROUP[group] ? p(GROUP[group]) : group),
    typeLabel: (type: string) => (TYPE_LABEL[type] ? p(TYPE_LABEL[type]) : type),
    typeDescription: (type: string) => (TYPE_DESCRIPTION[type] ? p(TYPE_DESCRIPTION[type]) : ''),
  }
}
