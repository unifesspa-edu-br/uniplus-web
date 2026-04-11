import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/**
 * Focus ring Gov.br DS: 4px dashed #c2850c (gold), offset 4px.
 *
 * Estratégia UNIFICADA: overlay <span> com position:fixed no document.body.
 * Não usa ::before/::after — evita corte por overflow de qualquer container.
 *
 * - Todos os elementos focáveis recebem overlay gold ao ganhar :focus-visible
 * - Inputs text focados via mouse NÃO recebem focus ring (Safari-like)
 * - Radio buttons: overlay circular no box (20x20px)
 * - Selects PrimeNG: overlay no p-select wrapper
 * - Demais: overlay retangular no próprio elemento
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
  const offset = circular ? 6 : 4;
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

function getOverlayTarget(el: HTMLElement): { target: HTMLElement; circular?: boolean } {
  // PrimeNG RadioButton: input[type=radio] is sr-only — overlay circular no box
  if (isHiddenRadio(el)) {
    const box = el.parentElement?.querySelector('[data-pc-section="box"]') as HTMLElement;
    if (box) return { target: box, circular: true };
  }
  // PrimeNG Select: span[role=combobox] is inside p-select
  const pSelect = el.closest('p-select') as HTMLElement;
  if (pSelect) return { target: pSelect };
  // Fallback: overlay no próprio elemento
  return { target: el };
}

document.addEventListener('focusin', (e) => {
  const el = e.target as HTMLElement;
  if (!el || el === document.body) return;

  // Mouse click em input text: sem focus ring (Safari-like)
  if (lastInputWasMouse && isTextInput(el)) {
    removeOverlay();
    return;
  }

  if (!el.matches(':focus-visible')) return;

  const { target, circular } = getOverlayTarget(el);
  createOverlay(target, circular);
});

document.addEventListener('focusout', () => {
  removeOverlay();
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
