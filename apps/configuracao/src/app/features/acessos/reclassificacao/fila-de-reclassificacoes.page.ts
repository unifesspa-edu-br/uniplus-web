import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EtapaDaVersao } from '@uniplus/shared-data/autorizacao';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { FilaDeReclassificacoesStore } from './fila-de-reclassificacoes.store';
import { mudancasDaPermissao } from './rotulos-da-reclassificacao';

const ID_DO_TITULO = 'cfg-fila-de-reclassificacoes-titulo';

interface Apresentacao {
  readonly titulo: string;
  readonly descricao: string;
}

const APRESENTACAO: Readonly<Record<EtapaDaVersao, Apresentacao>> = {
  gestao_de_acessos: {
    titulo: 'Reclassificações na gestão de acessos',
    descricao:
      'Permissões cujo escopo mudou e que mantêm concessões suspensas à espera da sua decisão.',
  },
  protecao_de_dados: {
    titulo: 'Reclassificações na proteção de dados',
    descricao:
      'Permissões cuja classificação subiu e que mantêm concessões suspensas à espera da sua decisão.',
  },
};

/** A fila da revisão das permissões reclassificadas, por etapa. */
@Component({
  selector: 'cfg-fila-de-reclassificacoes-page',
  standalone: true,
  imports: [
    RouterLink,
    DateBrPipe,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    RecusaDaLeituraComponent,
    SpinnerComponent,
  ],
  providers: [FilaDeReclassificacoesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './fila-de-reclassificacoes.page.html',
})
export class FilaDeReclassificacoesPage {
  /** A etapa vem da rota (`data.etapa`). */
  readonly etapa = input.required<EtapaDaVersao>();

  protected readonly store = inject(FilaDeReclassificacoesStore);
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly texto = computed(() => APRESENTACAO[this.etapa()]);
  protected readonly mudancas = mudancasDaPermissao;
  protected readonly leitura = acompanharLeitura({
    assunto: 'fila de reclassificações',
    falha: this.store.falha,
    pendente: this.store.carregando,
    indisponivel: signal(false),
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  constructor() {
    effect(() => {
      const etapa = this.etapa();
      untracked(() => this.store.etapa.set(etapa));
    });
  }

  protected concessoes(quantidade: number): string {
    return quantidade === 1 ? '1 concessão' : `${quantidade} concessões`;
  }
}
