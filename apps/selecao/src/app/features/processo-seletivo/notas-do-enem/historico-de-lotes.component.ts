import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isApiOk } from '@uniplus/shared-core/http';
import { numeroDaApi } from '@uniplus/shared-utils';
import { NotasDoEnemApi, type LoteDeNotasDoEnemDto } from '@uniplus/shared-data/selecao';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import {
  AlertComponent,
  EmptyStateComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';

import { AlertaDeRecusaComponent } from './alerta-de-recusa.component';
import { LoteDeNotasComponent } from './lote-de-notas.component';
import { OrigemDoLoteComponent } from './origem-do-lote.component';
import { NotasDoEnemDoProcesso } from './notas-do-enem-do-processo.service';
import { explicarRecusa, type RecusaExplicada } from './recusas-do-enem';
import { formatarTotal } from './resultado-do-lote';

type DetalheDoLote =
  | { readonly estado: 'lendo'; readonly id: string }
  | { readonly estado: 'falha'; readonly id: string; readonly recusa: RecusaExplicada }
  | { readonly estado: 'lido'; readonly id: string; readonly lote: LoteDeNotasDoEnemDto };

/** Os lotes de notas importados para a edição; o vigente é o que vale para a classificação. */
@Component({
  selector: 'sel-historico-de-lotes',
  standalone: true,
  imports: [
    AlertComponent,
    AlertaDeRecusaComponent,
    DateBrPipe,
    EmptyStateComponent,
    LoteDeNotasComponent,
    OrigemDoLoteComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './historico-de-lotes.component.html',
  styleUrl: './compartilhado.css',
})
export class HistoricoDeLotesComponent {
  private readonly api = inject(NotasDoEnemApi);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly notas = inject(NotasDoEnemDoProcesso);
  protected readonly total = formatarTotal;

  /** A contagem de um tipo de problema só pede atenção quando passa de zero. */
  protected readonly temOcorrencia = (valor: number | string): boolean => numeroDaApi(valor) > 0;
  /** O lote vigente sem nenhuma nota casada com inscritos costuma ser o arquivo de outra edição. */
  protected readonly semNotaCasada = (lote: LoteDeNotasDoEnemDto): boolean =>
    lote.vigente && numeroDaApi(lote.totalDeInscritosComNota) === 0;

  protected readonly detalhe = signal<DetalheDoLote | null>(null);
  private readonly tituloDoDetalhe = viewChild<ElementRef<HTMLElement>>('tituloDoDetalhe');

  constructor() {
    // O detalhe é de um lote do histórico em tela: trocar a edição ou reler o histórico (depois de
    // uma importação, o lote aberto pode deixar de ser o vigente) o descarta.
    effect(() => {
      this.notas.edicaoDeRetorno();
      this.notas.lotes();
      untracked(() => this.detalhe.set(null));
    });
  }

  /** Lê o lote com as ocorrências, que a lista não traz, e leva o foco ao título dele. */
  protected async verOcorrencias(lote: LoteDeNotasDoEnemDto): Promise<void> {
    const escolhido = this.notas.escolhidoDeRetorno();
    if (escolhido === null) return;

    this.detalhe.set({ estado: 'lendo', id: lote.id });
    const resultado = await firstValueFrom(
      this.api.obterLote(escolhido.processoId, escolhido.etapaId, escolhido.edicao, lote.id),
    );
    if (this.detalhe()?.id !== lote.id) return;

    this.detalhe.set(
      isApiOk(resultado)
        ? { estado: 'lido', id: lote.id, lote: resultado.data }
        : { estado: 'falha', id: lote.id, recusa: explicarRecusa(resultado.problem, 'lote') },
    );
    afterNextRender(() => this.tituloDoDetalhe()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  /** O botão que tinha o foco sai com o detalhe: o foco volta ao "Ver ocorrências" daquele lote. */
  protected fecharDetalhe(): void {
    const id = this.detalhe()?.id;
    this.detalhe.set(null);
    if (id === undefined) return;
    afterNextRender(
      () =>
        Array.from(this.elemento.nativeElement.querySelectorAll<HTMLElement>('button[data-lote]'))
          .find((botao) => botao.dataset['lote'] === id)
          ?.focus(),
      { injector: this.injector },
    );
  }
}
