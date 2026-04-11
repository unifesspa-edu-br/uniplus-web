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

function createOverlay(el: HTMLElement) {
  removeOverlay();
  const rect = el.getBoundingClientRect();
  const overlay = document.createElement('span');
  overlay.className = 'govbr-focus-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: ${rect.top - 8}px;
    left: ${rect.left - 8}px;
    width: ${rect.width + 16}px;
    height: ${rect.height + 16}px;
    border: 4px dashed #c2850c;
    border-radius: 4px;
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

function getFocusRingTarget(el: HTMLElement): { type: 'class'; target: HTMLElement } | { type: 'overlay'; target: HTMLElement } | null {
  // PrimeNG RadioButton: input[type=radio] is sr-only — use ::before on the wrapper div
  if (isHiddenRadio(el)) {
    const wrapper = el.closest('.flex.items-center') as HTMLElement ?? el.closest('p-radiobutton') as HTMLElement;
    if (wrapper) return { type: 'class', target: wrapper };
    return null;
  }
  // PrimeNG Select: span[role=combobox] is inside p-select
  const pSelect = el.closest('p-select') as HTMLElement;
  if (pSelect) return { type: 'overlay' as const, target: pSelect };
  // Native replaced elements (textarea, select)
  if (REPLACED_ELEMENTS.has(el.tagName)) return { type: 'overlay' as const, target: el };
  // Text inputs (input[type=text], etc.)
  if (isTextInput(el)) return { type: 'overlay' as const, target: el };
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
      createOverlay(result.target);
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
  // Remove focus ring from radio wrapper too
  if (isHiddenRadio(el)) {
    const wrapper = el.closest('.flex.items-center') as HTMLElement ?? el.closest('p-radiobutton') as HTMLElement;
    wrapper?.classList.remove('govbr-focus-ring');
  }
  removeOverlay();
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
