import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  acompanharLeitura,
  AlertComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaGrade } from './foco-da-grade';
import { devolverFocoDoRecorte } from './foco-do-recorte';
import { BUSCA_DE_MUNICIPIOS } from '@uniplus/shared-ui/components';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import { CalendarioMensalComponent } from './calendario-mensal.component';
import { CalendarioStore } from './calendario.store';
import { DiaNaoUtilDialogoComponent } from './dia-nao-util-dialogo.component';
import { EdicaoDosDiasNaoUteis } from './edicao-dos-dias-nao-uteis';
import { OcorrenciasDoDiaComponent } from './ocorrencias-do-dia.component';
import { AVISO_DO_FILTRO_REMOVIDO, ID_DO_CAMPO_DE_ABRANGENCIA } from './recorte-da-exibicao.util';
import { RecorteDaExibicao } from './recorte-da-exibicao';
import { RecorteDaGradeComponent } from './recorte-da-grade.component';
import { SelecaoDoDia } from './selecao-do-dia';

@Component({
  selector: 'cfg-calendario-dias-uteis-detalhe',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    SpinnerComponent,
    TagComponent,
    CalendarioMensalComponent,
    RecorteDaGradeComponent,
    OcorrenciasDoDiaComponent,
    DiaNaoUtilDialogoComponent,
  ],
  providers: [
    CalendarioStore,
    SelecaoDoDia,
    RecorteDaExibicao,
    { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
    EdicaoDosDiasNaoUteis,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendario-dias-uteis-detalhe.page.html',
  styleUrl: './calendario-dias-uteis-detalhe.page.css',
  host: { class: 'cfg-page' },
})
export class CalendarioDiasUteisDetalhePage {
  protected readonly store = inject(CalendarioStore);
  protected readonly selecao = inject(SelecaoDoDia);
  protected readonly recorte = inject(RecorteDaExibicao);
  protected readonly edicao = inject(EdicaoDosDiasNaoUteis);
  protected readonly avisoDoFiltroRemovido = AVISO_DO_FILTRO_REMOVIDO;
  private readonly titulo = viewChild.required<ElementRef<HTMLElement>>('titulo');
  protected readonly leitura = acompanharLeitura({
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-calendario-detalhe-title'),
    recusada: this.store.naoEncontrado,
  });

  constructor() {
    devolverFocoDaGrade({
      gravando: this.edicao.gravando,
      aberto: this.edicao.aberto,
      dataDoDia: () => this.selecao.dia()?.data,
      idDoTitulo: 'cfg-calendario-detalhe-title',
    });
    devolverFocoDoRecorte({
      filtroRemovido: this.recorte.filtroRemovido,
      destinos: [`#${ID_DO_CAMPO_DE_ABRANGENCIA}`, '.cfg-filtro-removido button'],
    });
    this.recomecarAoTrocarDeCalendario();
  }

  /** O botão do aviso some ao ser usado: o foco vai ao título, em vez de cair no corpo. */
  protected dispensarAvisoDoFiltro(): void {
    this.recorte.dispensarAvisoDoFiltroRemovido();
    this.titulo().nativeElement.focus();
  }

  /**
   * O Router reaproveita esta instância ao navegar entre duas rotas `:id`: sem limpar a seleção, o
   * painel reabriria sozinho com o dia do calendário anterior, e o recorte esconderia dias do outro
   * calendário por uma localidade que talvez nem exista nele.
   */
  private recomecarAoTrocarDeCalendario(): void {
    effect(() => {
      this.store.calendarioId();
      untracked(() => {
        this.selecao.limpar();
        this.recorte.limpar();
      });
    });
  }
}
