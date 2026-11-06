import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focarAposNovaTentativa } from '../../shared/foco';
import { CalendariosListaComponent } from './calendarios-lista.component';
import { CalendariosStore } from './calendarios.store';
import { AcionadorDaConfirmacao, EdicaoDosCalendarios } from './edicao-dos-calendarios';

const ID_DO_TITULO = 'cfg-calendario-dias-uteis-list-title';
const PREFIXO_DA_ACAO: Readonly<Record<AcionadorDaConfirmacao['acao'], string>> = {
  remover: 'Remover ',
  marcar: 'Marcar vigente ',
};

@Component({
  selector: 'cfg-calendario-dias-uteis-list',
  standalone: true,
  imports: [AlertComponent, CalendariosListaComponent, ConfirmacaoDeRemocaoComponent],
  providers: [CalendariosStore, EdicaoDosCalendarios],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendario-dias-uteis-list.page.html',
  host: { class: 'cfg-page' },
})
export class CalendarioDiasUteisListPage {
  protected readonly store = inject(CalendariosStore);
  protected readonly edicao = inject(EdicaoDosCalendarios);
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById(ID_DO_TITULO),
  );

  constructor() {
    effect(() => {
      if (this.edicao.confirmandoRemocao() || this.edicao.confirmandoVigencia()) return;
      const acionador = untracked(() => this.edicao.consumirAcionadorAposRecusa());
      if (acionador === null) return;
      // O diálogo devolve o foco ao botão que o abriu ao terminar de fechar, e esse botão pode ter
      // sumido ou estar indisponível; o destino certo é escolhido depois disso.
      afterNextRender(() => setTimeout(() => this.focarAposRecusa(acionador)), {
        injector: this.injector,
      });
    });
  }

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }

  /** O botão da linha, se a releitura o manteve habilitado; senão o título da lista. */
  private focarAposRecusa(acionador: AcionadorDaConfirmacao): void {
    const linha = `tr[data-calendario-id="${acionador.id.replace(/["\\]/g, '\\$&')}"]`;
    const botao = this.raiz.querySelector<HTMLButtonElement>(
      `${linha} button[aria-label^="${PREFIXO_DA_ACAO[acionador.acao]}"]`,
    );
    const alvo = botao !== null && !botao.disabled ? botao : null;
    (alvo ?? this.raiz.querySelector<HTMLElement>(`#${ID_DO_TITULO}`))?.focus();
  }
}
