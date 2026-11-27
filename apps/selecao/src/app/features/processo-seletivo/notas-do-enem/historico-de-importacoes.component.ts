import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isApiOk, type ApiResult } from '@uniplus/shared-core/http';
import { NotasDoEnemApi, type LoteDeNotasDoEnemDto } from '@uniplus/shared-data/selecao';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import {
  acompanharLeitura,
  EmptyStateComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';

import { mensagemDaFalha } from '../leitura';
import { AlertaDeRecusaComponent } from './alerta-de-recusa.component';
import { LoteDeNotasComponent } from './lote-de-notas.component';
import { OrigemDoLoteComponent } from './origem-do-lote.component';
import { NotasDoEnemDoProcesso } from './notas-do-enem-do-processo.service';
import { explicarRecusa, type RecusaExplicada } from './recusas-do-enem';
import { formatarTotal } from './resultado-do-lote';

type DetalheDaImportacao =
  | { readonly estado: 'lendo'; readonly id: string }
  | { readonly estado: 'falha'; readonly id: string; readonly recusa: RecusaExplicada }
  | { readonly estado: 'lido'; readonly id: string; readonly importacao: LoteDeNotasDoEnemDto };

function detalheLido(id: string, resultado: ApiResult<LoteDeNotasDoEnemDto>): DetalheDaImportacao {
  return isApiOk(resultado)
    ? { estado: 'lido', id, importacao: resultado.data }
    : { estado: 'falha', id, recusa: explicarRecusa(resultado.problem, 'lote') };
}

/** As importações de notas feitas para a edição; o vigente é o que vale para a classificação. */
@Component({
  selector: 'sel-historico-de-importacoes',
  standalone: true,
  imports: [
    AlertaDeRecusaComponent,
    DateBrPipe,
    EmptyStateComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    LoteDeNotasComponent,
    OrigemDoLoteComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './historico-de-importacoes.component.html',
  styleUrl: './compartilhado.css',
})
export class HistoricoDeImportacoesComponent {
  private readonly api = inject(NotasDoEnemApi);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly notas = inject(NotasDoEnemDoProcesso);
  protected readonly total = formatarTotal;
  protected readonly leitura = acompanharLeitura({
    falha: computed(() => mensagemDaFalha(this.notas.lotes())),
    pendente: this.notas.relendoLotes,
    recarregar: () => void this.notas.recarregarLotes(),
    destino: () => this.elemento.nativeElement.querySelector('h3'),
  });

  /** A contagem de um tipo de problema só pede atenção quando passa de zero. */
  protected readonly temOcorrencia = (valor: number): boolean => valor > 0;
  /** A importação vigente sem nenhuma nota casada com inscritos costuma ser o arquivo de outra edição. */
  protected readonly semNotaCasada = (importacao: LoteDeNotasDoEnemDto): boolean =>
    importacao.vigente && importacao.totalDeInscritosComNota === 0;

  protected readonly detalhe = signal<DetalheDaImportacao | null>(null);
  private readonly tituloDoDetalhe = viewChild<ElementRef<HTMLElement>>('tituloDoDetalhe');

  constructor() {
    // O detalhe é de uma importação do histórico em tela: trocar a edição ou reler o histórico (depois de
    // uma importação, a importação aberta pode deixar de ser o vigente) o descarta.
    effect(() => {
      this.notas.edicaoDeRetorno();
      this.notas.lotes();
      untracked(() => this.detalhe.set(null));
    });
  }

  /** Lê a importação com as ocorrências, que a lista não traz, e leva o foco ao título dela. */
  protected async verOcorrencias(importacao: LoteDeNotasDoEnemDto): Promise<void> {
    const escolhido = this.notas.escolhidoDeRetorno();
    if (escolhido === null) return;

    this.detalhe.set({ estado: 'lendo', id: importacao.id });
    const resultado = await firstValueFrom(
      this.api.obterLote(escolhido.processoId, escolhido.etapaId, escolhido.edicao, importacao.id),
    );
    if (this.detalhe()?.id !== importacao.id) return;

    this.detalhe.set(detalheLido(importacao.id, resultado));
    this.focarTituloDoDetalhe();
  }

  private focarTituloDoDetalhe(): void {
    afterNextRender(() => this.tituloDoDetalhe()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  /** O botão que tinha o foco sai com o detalhe: o foco volta ao "Ver ocorrências" daquela importação. */
  protected fecharDetalhe(): void {
    const id = this.detalhe()?.id;
    this.detalhe.set(null);
    if (id === undefined) return;
    afterNextRender(
      () =>
        Array.from(
          this.elemento.nativeElement.querySelectorAll<HTMLElement>('button[data-importacao]'),
        )
          .find((botao) => botao.dataset['importacao'] === id)
          ?.focus(),
      { injector: this.injector },
    );
  }
}
