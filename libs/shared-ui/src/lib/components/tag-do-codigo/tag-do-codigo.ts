import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { CodigoComRotulo } from '../codigo-com-rotulo';
import { TagComponent, type UiTagVariant } from '../tag/tag';

/**
 * A variante de cor de cada código do tipo. O mapa completo se declara numa constante com este
 * tipo explícito: um código do tipo sem variante faz a verificação de tipos falhar.
 */
export type VariantesDosCodigos<C extends string> = Readonly<Record<C, UiTagVariant>>;

/**
 * Mostra o rótulo que a API devolve para um código, na cor que o mapa de variantes dá a ele. O
 * rótulo é sempre o texto da etiqueta: a cor reforça o sinal, nunca o substitui. O código que o
 * mapa não conhece em execução (a API pode devolver um código que o cliente gerado ainda não
 * tem) aparece em cor neutra, com o rótulo.
 */
@Component({
  selector: 'ui-tag-do-codigo',
  standalone: true,
  imports: [TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ui-tag [variant]="variante()">{{ valor().rotulo }}</ui-tag>`,
})
export class TagDoCodigoComponent<C extends string> {
  readonly valor = input.required<CodigoComRotulo<C>>();
  readonly variantes = input.required<VariantesDosCodigos<C>>();

  protected readonly variante = computed(() => {
    const variantes = this.variantes();
    const { codigo } = this.valor();
    return Object.hasOwn(variantes, codigo) ? variantes[codigo] : 'neutral';
  });
}
