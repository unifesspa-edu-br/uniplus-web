import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';

/**
 * Leva o processo publicado à retificação. Aparece só quando a API confirmou a publicação e a
 * pessoa tem a permissão efetiva de configurar; o servidor segue decidindo em cada requisição.
 */
@Component({
  selector: 'sel-entrada-da-retificacao',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (oferecida()) {
      <a
        class="btn btn--secondary"
        [routerLink]="['/processo-seletivo', processoId(), 'retificacao']"
      >
        Retificar processo
      </a>
    }
  `,
})
export class EntradaDaRetificacaoComponent {
  private readonly permissoes = inject(PermissoesService);

  readonly processoId = input<string | null>(null);
  readonly situacao = input<SituacaoDoProcessoSeletivoCodigo | null>(null);
  readonly publicacaoNaoConfirmada = input(false);

  protected readonly oferecida = computed(
    () =>
      this.processoId() !== null &&
      this.situacao() === SituacaoDoProcessoSeletivoCodigo.PUBLICADO &&
      !this.publicacaoNaoConfirmada() &&
      this.permissoes.tem(PERMISSAO.selecao.processosConfigurar),
  );
}
