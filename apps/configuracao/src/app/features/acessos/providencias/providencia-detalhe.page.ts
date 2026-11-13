import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { MotivoDialogComponent } from '../motivo-dialog.component';
import { nomesDeEscopo } from '../nomes-de-escopo';
import { RevogarConcessaoDialogComponent } from '../revogar-concessao-dialog.component';
import { autorDoEvento } from '../trilha-de-acesso.component';
import { ProvidenciaDetalheStore } from './providencia-detalhe.store';
import {
  encerramentoDaConcessao,
  situacaoDaProvidencia,
  tipoDaProvidencia,
} from './rotulos-da-providencia';
import { TramitacaoDaProvidencia } from './tramitacao-da-providencia';

const ID_DO_TITULO = 'cfg-providencia-titulo';

/**
 * Uma providência sobre concessão, a tela dos links dos avisos por e-mail: a situação, o
 * fundamento, a concessão, o que a encerrou na prejudicada e o desfecho. Quem administra
 * concessões responde ou atende a aberta, salvo se a solicitou ou é o beneficiário.
 */
@Component({
  selector: 'cfg-providencia-detalhe-page',
  standalone: true,
  imports: [
    RouterLink,
    DateBrPipe,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    MotivoDialogComponent,
    RecusaDaLeituraComponent,
    RevogarConcessaoDialogComponent,
    SpinnerComponent,
    TagComponent,
  ],
  providers: [ProvidenciaDetalheStore, TramitacaoDaProvidencia],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './providencia-detalhe.page.html',
})
export class ProvidenciaDetalhePage {
  /** Vem do parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly store = inject(ProvidenciaDetalheStore);
  protected readonly tramitacao = inject(TramitacaoDaProvidencia);
  private readonly permissoes = inject(PermissoesService);
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly escopo = nomesDeEscopo();
  protected readonly pessoa = autorDoEvento;
  protected readonly situacao = situacaoDaProvidencia;
  protected readonly tipo = tipoDaProvidencia;
  protected readonly encerramento = encerramentoDaConcessao;
  /** Responde e atende quem administra concessões, a providência aberta, sem impedimento. */
  protected readonly podeTramitar = computed(() => {
    const providencia = this.store.dados();
    return (
      providencia?.situacao === 'aberta' &&
      !providencia.impedidoDeResponder &&
      this.permissoes.tem(PERMISSAO.autorizacao.concessoesAdministrar)
    );
  });
  protected readonly leitura = acompanharLeitura({
    assunto: 'providência',
    falha: this.store.falha,
    pendente: this.store.carregando,
    indisponivel: this.tramitacao.enviando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.store.id.set(id));
    });
  }

  protected visivel(ato: 'responder' | 'atender'): boolean {
    return this.tramitacao.aberto() === ato;
  }

  protected mudarVisibilidade(aberto: boolean): void {
    if (!aberto) this.tramitacao.fechar();
  }
}
