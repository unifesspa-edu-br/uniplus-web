import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ResolucaoDeVinculo } from '@uniplus/shared-core/http';

/**
 * Rótulo de uma chave estrangeira resolvida por lookup.
 *
 * Exibe o texto quando o vínculo resolveu e, quando não resolveu, um marcador
 * que diz **qual** dos desfechos ocorreu. Colapsar os três num fallback só
 * ("Vinculado") faz falha de carregamento parecer dado legítimo, e foi assim
 * que uma indisponibilidade dos catálogos passou despercebida na listagem
 * (#579).
 *
 * O marcador não carrega a ação de nova tentativa: numa tabela ela se
 * repetiria por linha. Quem oferece o "tentar novamente" é a tela, uma vez, no
 * alerta que anuncia o catálogo recusado.
 */
@Component({
  selector: 'ui-lookup-label',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (estado() === 'resolvido') {
      {{ resolucao().rotulo }}
    } @else {
      <span
        class="lookup-label"
        [class.lookup-label--pending]="estado() === 'carregando'"
        [class.lookup-label--failed]="estado() === 'falhou'"
        [class.lookup-label--missing]="estado() === 'ausente'"
        >{{ marcador() }}</span
      >
    }
  `,
})
export class LookupLabelComponent {
  readonly resolucao = input.required<ResolucaoDeVinculo>();

  protected readonly estado = computed(() => this.resolucao().estado);

  protected readonly marcador = computed(() => {
    switch (this.estado()) {
      case 'carregando':
        return 'Carregando…';
      case 'falhou':
        return 'Não carregado';
      default:
        return 'Não identificado';
    }
  });
}
