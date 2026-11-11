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
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { FilaDeJanelasStore } from './fila-de-janelas.store';

const ID_DO_TITULO = 'cfg-fila-de-janelas-titulo';

interface Apresentacao {
  readonly titulo: string;
  readonly descricao: string;
}

const APRESENTACAO: Readonly<Record<EtapaDaVersao, Apresentacao>> = {
  gestao_de_acessos: {
    titulo: 'Janelas de migração na gestão de acessos',
    descricao:
      'Janelas abertas em que há lote a enviar ou concessões retidas para a sua decisão, dentro do prazo.',
  },
  protecao_de_dados: {
    titulo: 'Janelas de migração na proteção de dados',
    descricao:
      'Janelas abertas com concessões que aguardam a adequação à proteção de dados, dentro do prazo.',
  },
};

/** A fila das janelas de migração em que a pessoa tem o que decidir numa etapa. */
@Component({
  selector: 'cfg-fila-de-janelas-page',
  standalone: true,
  imports: [
    RouterLink,
    DateBrPipe,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    RecusaDaLeituraComponent,
    SpinnerComponent,
    TagComponent,
  ],
  providers: [FilaDeJanelasStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './fila-de-janelas.page.html',
})
export class FilaDeJanelasPage {
  /** A etapa vem da rota (`data.etapa`). */
  readonly etapa = input.required<EtapaDaVersao>();

  protected readonly store = inject(FilaDeJanelasStore);
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly texto = computed(() => APRESENTACAO[this.etapa()]);
  protected readonly leitura = acompanharLeitura({
    assunto: 'fila de janelas de migração',
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
