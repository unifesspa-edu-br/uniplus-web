/**
 * PassThrough Gov.br DS para PrimeNG unstyled mode.
 *
 * Mapeia classes Tailwind com tokens Gov.br para cada slot de cada componente
 * PrimeNG usado na PoC. Elimina a necessidade de CSS overrides com !important
 * (hipótese H3 do plano).
 *
 * Referência de slots: node_modules/primeng/types/primeng-types-*.d.ts
 */

const FONT_GOVBR = "font-['Rawline','Raleway',sans-serif]";
const FOCUS_CLASSES = 'focus-visible:outline-none';

export const govbrPassThrough = {
  /* ──────────────────── TABS ──────────────────── */
  tabs: {
    root: { class: 'flex flex-col' },
  },
  tablist: {
    root: { class: 'relative flex' },
    content: { class: 'flex overflow-x-auto overflow-y-hidden p-2 -m-2' },
    tabList: { class: 'flex border-b border-govbr-gray-10 gap-0' },
    activeBar: { class: 'hidden' },
    prevButton: { class: 'hidden' },
    nextButton: { class: 'hidden' },
  },
  tab: {
    root: {
      class: [
        'px-govbr-5 py-govbr-4 cursor-pointer select-none',
        'text-[20.16px] font-medium text-govbr-gray-60',
        `${FONT_GOVBR} bg-transparent`,
        'border-b-4 border-transparent',
        'transition-colors duration-200',
        'data-[p-active=true]:text-govbr-primary data-[p-active=true]:border-govbr-primary data-[p-active=true]:font-semibold',
        'hover:text-govbr-primary-light',
        FOCUS_CLASSES,
      ].join(' '),
    },
  },
  tabpanels: {
    root: { class: '' },
  },
  tabpanel: {
    root: { class: 'py-govbr-5' },
  },

  /* ──────────────────── INPUT TEXT ──────────────────── */
  inputtext: {
    root: {
      class: [
        'w-full px-[12px] py-[8px]',
        'border border-govbr-gray-20 rounded-govbr-sm',
        'bg-govbr-pure-0 text-govbr-gray-80',
        `${FONT_GOVBR} text-govbr-base`,
        'placeholder:text-govbr-gray-40',
        'focus:border-govbr-primary focus:outline-none',
        'disabled:opacity-60 disabled:cursor-not-allowed',
      ].join(' '),
    },
  },

  /* ──────────────────── SELECT (Dropdown) ──────────────────── */
  select: {
    root: {
      class: [
        'inline-flex items-center relative w-full',
        'border border-govbr-gray-20 rounded-govbr-sm',
        'bg-govbr-pure-0 cursor-pointer',
        'focus-within:border-govbr-primary',
        FOCUS_CLASSES,
      ].join(' '),
    },
    label: {
      class: [
        'flex-1 px-3 py-2 text-left truncate',
        `${FONT_GOVBR} text-govbr-base text-govbr-gray-80`,
        'data-[p-placeholder=true]:text-govbr-gray-40',
      ].join(' '),
    },
    dropdown: {
      class: 'flex items-center justify-center px-2 text-govbr-gray-60',
    },
    overlay: {
      class: [
        'bg-govbr-pure-0 border border-govbr-gray-20 rounded-govbr-sm shadow-lg',
        'mt-1 z-50',
      ].join(' '),
    },
    listContainer: {
      class: 'max-h-60 overflow-auto',
    },
    list: {
      class: 'py-1',
    },
    option: {
      class: [
        'px-3 py-2 cursor-pointer',
        `${FONT_GOVBR} text-govbr-base text-govbr-gray-80`,
        'hover:bg-govbr-primary-lightest',
        'data-[p-selected=true]:bg-govbr-primary data-[p-selected=true]:text-govbr-pure-0',
        'data-[p-focused=true]:bg-govbr-primary-lightest',
        FOCUS_CLASSES,
      ].join(' '),
    },
    optionLabel: { class: '' },
  },

  /* ──────────────────── RADIO BUTTON ──────────────────── */
  radiobutton: {
    root: {
      class: 'inline-flex items-center gap-govbr-2 cursor-pointer',
    },
    input: {
      class: 'peer sr-only',
    },
    box: {
      class: [
        'flex items-center justify-center',
        'w-5 h-5 rounded-full border-2 border-govbr-gray-20',
        'bg-govbr-pure-0 transition-colors',
        'peer-checked:border-govbr-primary',
        'peer-focus-visible:outline-none',
      ].join(' '),
    },
    icon: {
      class: [
        'w-2.5 h-2.5 rounded-full bg-transparent transition-colors',
        'peer-checked:bg-govbr-primary',
      ].join(' '),
    },
  },

  /* ──────────────────── BUTTON ──────────────────── */
  button: {
    root: {
      class: [
        'inline-flex items-center justify-center gap-2',
        'h-10 px-govbr-5 rounded-govbr-pill',
        `${FONT_GOVBR} text-[16.8px] font-semibold`,
        'cursor-pointer select-none transition-colors',
        'bg-govbr-primary text-govbr-pure-0',
        'hover:bg-govbr-primary-hover',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        FOCUS_CLASSES,
      ].join(' '),
    },
    label: { class: '' },
    icon: { class: '' },
  },

  /* ──────────────────── DIALOG ──────────────────── */
  dialog: {
    root: {
      class: [
        'rounded-govbr-md bg-govbr-pure-0 shadow-lg',
        'border border-govbr-gray-20',
        'max-w-[480px] w-[90vw]',
      ].join(' '),
    },
    mask: {
      class: 'fixed inset-0 bg-black/50 z-40 flex items-center justify-center',
    },
    header: {
      class: 'flex items-center justify-between px-govbr-5 pt-govbr-5 pb-govbr-2',
    },
    title: {
      class: `text-govbr-lg font-bold text-govbr-gray-80 ${FONT_GOVBR}`,
    },
    content: {
      class: `px-govbr-5 pb-govbr-4 text-govbr-base text-govbr-gray-60 ${FONT_GOVBR}`,
    },
    footer: {
      class: 'flex justify-end gap-govbr-3 px-govbr-5 pb-govbr-5',
    },
  },

  /* ──────────────────── CONFIRM DIALOG ──────────────────── */
  confirmdialog: {
    root: {
      class: [
        'rounded-govbr-md bg-govbr-pure-0 shadow-lg',
        'border border-govbr-gray-20',
        'max-w-[480px] w-[90vw]',
      ].join(' '),
    },
    mask: {
      class: 'fixed inset-0 bg-black/50 z-40 flex items-center justify-center',
    },
    header: {
      class: 'flex items-center justify-between px-govbr-5 pt-govbr-5 pb-govbr-2',
    },
    title: {
      class: `text-govbr-lg font-bold text-govbr-gray-80 ${FONT_GOVBR}`,
    },
    content: {
      class: `px-govbr-5 pb-govbr-4 text-govbr-base text-govbr-gray-60 ${FONT_GOVBR}`,
    },
    footer: {
      class: 'flex justify-end gap-govbr-3 px-govbr-5 pb-govbr-5',
    },
    pcAcceptButton: {
      root: {
        class: [
          'inline-flex items-center justify-center gap-2',
          'h-10 px-govbr-5 rounded-govbr-pill',
          `${FONT_GOVBR} text-[16.8px] font-semibold`,
          'cursor-pointer transition-colors',
          'bg-govbr-success text-govbr-pure-0',
          'hover:brightness-90',
          FOCUS_CLASSES,
        ].join(' '),
      },
    },
    pcRejectButton: {
      root: {
        class: [
          'inline-flex items-center justify-center gap-2',
          'h-10 px-govbr-5 rounded-govbr-pill',
          `${FONT_GOVBR} text-[16.8px] font-semibold`,
          'cursor-pointer transition-colors',
          'bg-transparent text-govbr-gray-60 border border-govbr-gray-20',
          'hover:bg-govbr-gray-2',
          FOCUS_CLASSES,
        ].join(' '),
      },
    },
  },

  /* ──────────────────── MESSAGE ──────────────────── */
  message: {
    root: {
      class: 'flex items-start gap-govbr-3 p-govbr-4 rounded-govbr-sm',
    },
    icon: {
      class: 'shrink-0 w-5 h-5 mt-0.5',
    },
    text: {
      class: `${FONT_GOVBR} text-govbr-sm`,
    },
  },

  /* ──────────────────── TABLE (DataTable) ──────────────────── */
  datatable: {
    root: {
      class: 'w-full',
    },
    tableContainer: {
      class: 'overflow-auto',
    },
    table: {
      class: 'w-full border-collapse border border-govbr-gray-10',
    },
    thead: {
      class: '',
    },
    tbody: {
      class: '',
    },
    headerCell: {
      class: [
        'bg-govbr-primary text-govbr-pure-0',
        'text-left px-govbr-4 py-govbr-3',
        `${FONT_GOVBR} text-govbr-sm font-semibold`,
      ].join(' '),
    },
    bodyCell: {
      class: [
        'px-govbr-4 py-govbr-3',
        `${FONT_GOVBR} text-govbr-sm text-govbr-gray-80`,
      ].join(' '),
    },
    bodyRow: {
      class: 'even:bg-govbr-gray-2 hover:bg-govbr-primary-lightest transition-colors border-t border-govbr-gray-10',
    },
  },
};
