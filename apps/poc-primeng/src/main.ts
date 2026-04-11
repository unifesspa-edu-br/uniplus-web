import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Focus ring Gov.br DS: 4px dashed #c2850c (gold), offset 4px.
 *
 * Estratégia (contorna bug outline-color em Tailwind v4):
 * - Elementos normais (buttons, tabs, divs): classe .govbr-focus-ring
 *   que ativa ::before com border: 4px dashed #c2850c
 * - Replaced elements (input, textarea, select, .p-select): overlay <span>
 *   com border: 4px dashed #c2850c posicionado sobre o elemento
 *
 * Detecção mouse/keyboard: inputs text focados via clique de mouse NÃO
 * recebem focus ring (comportamento Safari-like). Via Tab key, recebem.
 */
let lastInputWasMouse = false;

document.addEventListener('mousedown', () => {
  lastInputWasMouse = true;
  document.documentElement.dataset['focusSource'] = 'mouse';
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    lastInputWasMouse = false;
    delete document.documentElement.dataset['focusSource'];
  }
});

let activeOverlay: HTMLElement | null = null;

function removeOverlay() {
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }
}

function createOverlay(el: HTMLElement, circular = false) {
  removeOverlay();
  const rect = el.getBoundingClientRect();
  const offset = circular ? 6 : 8;
  const radius = circular ? '9999px' : '4px';
  const overlay = document.createElement('span');
  overlay.className = 'govbr-focus-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: ${rect.top - offset}px;
    left: ${rect.left - offset}px;
    width: ${rect.width + offset * 2}px;
    height: ${rect.height + offset * 2}px;
    border: 4px dashed #c2850c;
    border-radius: ${radius};
    pointer-events: none;
    z-index: 9999;
  `;
  document.body.appendChild(overlay);
  activeOverlay = overlay;
}

const REPLACED_ELEMENTS = new Set(['TEXTAREA', 'SELECT']);

function isTextInput(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return type === 'text' || type === 'email' || type === 'tel' || type === 'url' || type === 'search' || type === 'password';
  }
  return false;
}

function isHiddenRadio(el: HTMLElement): boolean {
  return el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'radio';
}

interface FocusRingResult {
  type: 'class' | 'overlay';
  target: HTMLElement;
  circular?: boolean;
}

function getFocusRingTarget(el: HTMLElement): FocusRingResult | null {
  // PrimeNG RadioButton: input[type=radio] is sr-only — overlay circular no box
  if (isHiddenRadio(el)) {
    const box = el.parentElement?.querySelector('[data-pc-section="box"]') as HTMLElement;
    if (box) return { type: 'overlay', target: box, circular: true };
    return null;
  }
  // PrimeNG Select: span[role=combobox] is inside p-select
  const pSelect = el.closest('p-select') as HTMLElement;
  if (pSelect) return { type: 'overlay', target: pSelect };
  // Native replaced elements (textarea, select)
  if (REPLACED_ELEMENTS.has(el.tagName)) return { type: 'overlay', target: el };
  // Text inputs (input[type=text], etc.)
  if (isTextInput(el)) return { type: 'overlay', target: el };
  return null;
}

document.addEventListener('focusin', (e) => {
  const el = e.target as HTMLElement;
  if (!el || el === document.body) return;

  if (lastInputWasMouse && isTextInput(el)) {
    el.classList.remove('govbr-focus-ring');
    removeOverlay();
    return;
  }

  if (!el.matches(':focus-visible')) return;

  const result = getFocusRingTarget(el);
  if (result) {
    if (result.type === 'overlay') {
      createOverlay(result.target, result.circular);
    } else {
      result.target.classList.add('govbr-focus-ring');
    }
  } else {
    el.classList.add('govbr-focus-ring');
  }
});

document.addEventListener('focusout', (e) => {
  const el = e.target as HTMLElement;
  if (!el) return;
  el.classList.remove('govbr-focus-ring');
  removeOverlay();
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
