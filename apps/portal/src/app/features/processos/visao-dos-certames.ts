import { Injectable, computed, effect, signal } from '@angular/core';
import { mediaQuerySignal } from '@uniplus/shared-core/dom';
import type { UiSegmentedOption } from '@uniplus/shared-ui/components';

export type Visao = 'lista' | 'cards';

export const OPCOES_DE_VISAO: readonly UiSegmentedOption<Visao>[] = [
  { value: 'lista', label: 'Lista', icon: 'pi-list' },
  { value: 'cards', label: 'Cards', icon: 'pi-th-large' },
];

/** Abaixo desta largura a lista é a forma canônica (decisão do design system). */
const COMPACT_MEDIA_QUERY = '(max-width: 599.98px)';

const VISAO_STORE_KEY = 'uniplus.portal.certames-visao';

function lerVisaoSalva(): Visao {
  try {
    return localStorage.getItem(VISAO_STORE_KEY) === 'cards' ? 'cards' : 'lista';
  } catch {
    return 'lista';
  }
}

function salvarVisao(visao: Visao): void {
  try {
    localStorage.setItem(VISAO_STORE_KEY, visao);
  } catch {
    // Storage pode estar indisponível em navegação privada.
  }
}

/**
 * Como a vitrine mostra os certames, lista ou cards, lembrada entre visitas. Abaixo de 600px a lista é
 * a forma canônica: o controle de alternância some e a visão fica travada em lista, mesmo com "cards"
 * salvo. Provida pela página.
 */
@Injectable()
export class VisaoDosCertames {
  private readonly escolhida = signal<Visao>(lerVisaoSalva());

  /** Detecta a largura em que a lista é a forma canônica (<600px), via `matchMedia`. */
  readonly isCompacto = mediaQuerySignal(COMPACT_MEDIA_QUERY);

  readonly visao = this.escolhida.asReadonly();
  readonly visaoEfetiva = computed<Visao>(() => (this.isCompacto() ? 'lista' : this.escolhida()));

  constructor() {
    effect(() => salvarVisao(this.escolhida()));
  }

  escolher(visao: Visao | null): void {
    if (visao !== null) {
      this.escolhida.set(visao);
    }
  }
}
