import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PermissoesService } from '@uniplus/shared-auth/bootstrap';

import { PERMISSOES_DOS_ATALHOS_DO_ACOMPANHAMENTO } from '../../../acesso/permissoes-das-telas';
import { TrilhaContextual } from '../../../trilha-contextual';
import { AcompanhamentoDoProcessoComponent } from './acompanhamento-do-processo.component';
import { atalhosDoAcompanhamento } from './atalhos-do-acompanhamento';
import { ConsultaDoAcompanhamento } from './consulta-do-acompanhamento';

const ROTA_DO_PAINEL = '/dashboard';

/**
 * Página contextual do acompanhamento: lê a rota, consulta o processo, decide os atalhos pelas
 * permissões, dá ao shell a trilha com o nome do processo e entrega o resto à apresentação, que não
 * conhece nenhum desses assuntos.
 */
@Component({
  selector: 'sel-acompanhamento-do-processo-page',
  standalone: true,
  imports: [AcompanhamentoDoProcessoComponent, RouterLink],
  providers: [ConsultaDoAcompanhamento],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A apresentação interna é quem organiza o leiaute; esta página não cria uma caixa a mais.
  styles: `
    :host {
      display: contents;
    }
  `,
  template: `
    <sel-acompanhamento-do-processo
      [situacao]="consulta.situacao()"
      [destinoDoPainel]="rotaDoPainel"
      (tentarNovamente)="consulta.tentarNovamente()"
    >
      @for (atalho of atalhos(); track atalho.rotulo) {
        <a acoesDoProcesso class="btn btn--secondary" [routerLink]="atalho.destino">{{
          atalho.rotulo
        }}</a>
      }
    </sel-acompanhamento-do-processo>
  `,
})
export class AcompanhamentoDoProcessoPage {
  protected readonly consulta = inject(ConsultaDoAcompanhamento);
  private readonly permissoes = inject(PermissoesService);
  private readonly trilha = inject(TrilhaContextual);
  protected readonly rotaDoPainel = ROTA_DO_PAINEL;

  protected readonly atalhos = computed(() => {
    const situacao = this.consulta.situacao();
    const pode =
      this.permissoes.estado() === 'carregada' &&
      this.permissoes.temAlguma(...PERMISSOES_DOS_ATALHOS_DO_ACOMPANHAMENTO);
    return situacao.estado === 'lido' ? atalhosDoAcompanhamento(situacao.processo, pode) : [];
  });

  /** Computed, para a trilha não ser regravada a cada novo objeto de situação com o mesmo nome. */
  private readonly nomeDoProcesso = computed(() => {
    const situacao = this.consulta.situacao();
    return situacao.estado === 'lido' ? situacao.processo.nome : null;
  });

  constructor() {
    effect(() =>
      this.trilha.definir(trilhaDoAcompanhamento(ROTA_DO_PAINEL, this.nomeDoProcesso())),
    );
    inject(DestroyRef).onDestroy(() => this.trilha.limpar());
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed())
      .subscribe((parametros) => this.consulta.abrir(parametros.get('id') ?? ''));
  }
}

function trilhaDoAcompanhamento(destinoDoPainel: string, nome: string | null) {
  const painel = { label: 'Painel de processos', routerLink: destinoDoPainel };
  const acompanhamento = { label: 'Acompanhamento' };
  return nome === null ? [painel, acompanhamento] : [painel, { label: nome }, acompanhamento];
}
