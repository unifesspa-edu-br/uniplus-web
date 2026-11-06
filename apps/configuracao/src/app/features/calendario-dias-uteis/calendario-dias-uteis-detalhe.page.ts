import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertComponent, SpinnerComponent, TagComponent } from '@uniplus/shared-ui/components';
import { focarAposNovaTentativa } from '../../shared/foco';
import { devolverFocoDaGrade } from './foco-da-grade';
import { BuscaDeMunicipios } from './busca-de-municipios';
import { MUNICIPIO_BUSCA_VAZIA } from './calendario-dias-uteis.util';
import { CalendarioMensalComponent } from './calendario-mensal.component';
import { CalendarioStore } from './calendario.store';
import { DiaNaoUtilDialogoComponent } from './dia-nao-util-dialogo.component';
import { EdicaoDosDiasNaoUteis } from './edicao-dos-dias-nao-uteis';
import { OcorrenciasDoDiaComponent } from './ocorrencias-do-dia.component';
import { SelecaoDoDia } from './selecao-do-dia';

@Component({
  selector: 'cfg-calendario-dias-uteis-detalhe',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    SpinnerComponent,
    TagComponent,
    CalendarioMensalComponent,
    OcorrenciasDoDiaComponent,
    DiaNaoUtilDialogoComponent,
  ],
  providers: [CalendarioStore, SelecaoDoDia, BuscaDeMunicipios, EdicaoDosDiasNaoUteis],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendario-dias-uteis-detalhe.page.html',
  styleUrl: './calendario-dias-uteis-detalhe.page.css',
  host: { class: 'cfg-page' },
})
export class CalendarioDiasUteisDetalhePage {
  protected readonly store = inject(CalendarioStore);
  protected readonly selecao = inject(SelecaoDoDia);
  protected readonly busca = inject(BuscaDeMunicipios);
  protected readonly edicao = inject(EdicaoDosDiasNaoUteis);
  protected readonly buscaDoDia = computed(
    () => this.busca.buscas().get(this.edicao.form) ?? MUNICIPIO_BUSCA_VAZIA,
  );
  private readonly novaTentativa = focarAposNovaTentativa(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-calendario-detalhe-title'),
  );

  constructor() {
    devolverFocoDaGrade({
      gravando: this.edicao.gravando,
      aberto: this.edicao.aberto,
      dataDoDia: () => this.selecao.dia()?.data,
      idDoTitulo: 'cfg-calendario-detalhe-title',
    });
    // O Router reaproveita esta instância ao navegar entre duas rotas `:id`: sem limpar a
    // seleção, o painel reabriria sozinho com o dia do calendário anterior.
    effect(() => {
      this.store.calendarioId();
      untracked(() => this.selecao.limpar());
    });
  }

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }
}
