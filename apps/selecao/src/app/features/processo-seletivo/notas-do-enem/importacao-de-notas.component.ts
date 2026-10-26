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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { isApiOk } from '@uniplus/shared-core/http';
import { numeroDaApi } from '@uniplus/shared-utils';
import { NotasDoEnemApi, type LoteDeNotasDoEnemDto } from '@uniplus/shared-data/selecao';
import { AlertComponent, FileUploadComponent } from '@uniplus/shared-ui/components';

import { AlertaDeRecusaComponent } from './alerta-de-recusa.component';
import { HistoricoDeLotesComponent } from './historico-de-lotes.component';
import { OrientacoesDoEnemComponent } from './orientacoes-do-enem.component';
import { SeletorDeEdicaoComponent } from './seletor-de-edicao.component';
import { leiauteDaChave } from './leiautes';
import { LoteDeNotasComponent } from './lote-de-notas.component';
import { OrigemDoLoteComponent } from './origem-do-lote.component';
import { NotasDoEnemDoProcesso, mesmoEscopo } from './notas-do-enem-do-processo.service';
import { explicarRecusa, falhaIncerta, type RecusaExplicada } from './recusas-do-enem';
import { fraseDoLote, totaisDoLote } from './resultado-do-lote';
import { SeletorDeLeiauteComponent } from './seletor-de-leiaute.component';

/** O lote que a importação devolveu e se ele é novo (201) ou o que já estava vigente (200). */
interface ResultadoDaImportacao {
  readonly lote: LoteDeNotasDoEnemDto;
  readonly criado: boolean;
  /** O histórico já lido da edição tinha lote quando a importação foi pedida. */
  readonly haviaLoteAnterior: boolean;
}

/**
 * Importa o arquivo de retorno do INEP. O navegador não lê o conteúdo: o `File` segue direto no
 * formulário, e a tela não o pré-visualiza, porque traz dados pessoais.
 */
@Component({
  selector: 'sel-importacao-de-notas',
  standalone: true,
  imports: [
    AlertComponent,
    AlertaDeRecusaComponent,
    FileUploadComponent,
    HistoricoDeLotesComponent,
    LoteDeNotasComponent,
    OrigemDoLoteComponent,
    OrientacoesDoEnemComponent,
    SeletorDeEdicaoComponent,
    SeletorDeLeiauteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './importacao-de-notas.component.html',
  styleUrls: ['./compartilhado.css', './acao-do-card.css'],
})
export class ImportacaoDeNotasComponent {
  private readonly api = inject(NotasDoEnemApi);
  private readonly injector = inject(Injector);
  protected readonly notas = inject(NotasDoEnemDoProcesso);

  protected readonly leiaute = new FormControl('', { nonNullable: true });
  protected readonly arquivo = signal<File | null>(null);
  protected readonly erroDoLeiaute = signal<string | null>(null);
  protected readonly erroDoArquivo = signal<string | null>(null);
  protected readonly importando = signal(false);
  protected readonly recusa = signal<RecusaExplicada | null>(null);
  protected readonly resultado = signal<ResultadoDaImportacao | null>(null);

  private readonly seletor = viewChild(SeletorDeLeiauteComponent);
  private readonly zonaDeArquivo = viewChild<ElementRef<HTMLElement>>('zonaDeArquivo');
  private readonly alerta = viewChild(AlertaDeRecusaComponent);
  private readonly tituloDoResultado = viewChild<ElementRef<HTMLElement>>('tituloDoResultado');

  constructor() {
    // O que a tela mostra é do processo e da edição em que a importação foi pedida: trocar um dos
    // dois descarta a recusa e o resultado, que não dizem nada sobre o novo escopo.
    effect(() => {
      this.notas.processoId();
      this.notas.edicaoDeRetorno();
      untracked(() => {
        this.recusa.set(null);
        this.resultado.set(null);
      });
    });
    this.leiaute.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.erroDoLeiaute.set(null));
  }

  protected escolherEdicao(edicao: string): void {
    void this.notas.escolherEdicaoDeRetorno(edicao);
  }

  protected frase(lote: LoteDeNotasDoEnemDto): string {
    return fraseDoLote(totaisDoLote(lote));
  }

  protected nenhumaNotaCasou(lote: LoteDeNotasDoEnemDto): boolean {
    return numeroDaApi(lote.totalDeInscritosComNota) === 0;
  }

  protected escolherArquivo(arquivo: File | null): void {
    this.arquivo.set(arquivo);
    if (arquivo !== null) this.erroDoArquivo.set(null);
  }

  protected async importar(): Promise<void> {
    if (this.importando()) return;
    this.recusa.set(null);
    this.resultado.set(null);

    const escolhido = this.notas.escolhidoDeRetorno();
    const catalogo = this.notas.leiautesDeRetorno();
    const leiaute =
      catalogo.estado === 'lido' ? leiauteDaChave(catalogo.dados, this.leiaute.value) : null;
    const arquivo = this.arquivo();
    if (escolhido === null) return;
    if (leiaute === null || arquivo === null) {
      this.recusarPedidoIncompleto(leiaute === null, arquivo === null);
      return;
    }
    this.erroDoLeiaute.set(null);
    this.erroDoArquivo.set(null);

    const lotes = this.notas.lotes();
    const haviaLoteAnterior = lotes.estado === 'lido' && lotes.dados.length > 0;
    this.importando.set(true);
    try {
      const resposta = await firstValueFrom(
        this.api.importarNotas(
          escolhido.processoId,
          escolhido.etapaId,
          escolhido.edicao,
          arquivo,
          leiaute,
        ),
      );
      // O arquivo sai da tela quando a importação dá certo; na recusa ele fica, para o operador
      // trocar só o leiaute e reenviar.
      if (isApiOk(resposta)) this.arquivo.set(null);
      if (!mesmoEscopo(this.notas.escolhidoDeRetorno(), escolhido)) return;
      if (isApiOk(resposta)) {
        this.resultado.set({
          lote: resposta.data,
          criado: resposta.status === 201,
          haviaLoteAnterior,
        });
        void this.notas.recarregarLotes();
        afterNextRender(() => this.tituloDoResultado()?.nativeElement.focus(), {
          injector: this.injector,
        });
      } else {
        this.mostrarRecusa(
          explicarRecusa(resposta.problem, 'importacao', { variosLeiautes: this.variosLeiautes() }),
        );
        // Na falha incerta o lote pode ter sido gravado: o histórico é o que o operador confere.
        if (falhaIncerta(resposta.problem)) void this.notas.recarregarLotes();
      }
    } finally {
      this.importando.set(false);
    }
  }

  private variosLeiautes(): boolean {
    const catalogo = this.notas.leiautesDeRetorno();
    return catalogo.estado !== 'lido' || catalogo.dados.length > 1;
  }

  protected recarregarCatalogo(): void {
    this.leiaute.setValue('');
    void this.notas.recarregarLeiautes('retorno');
  }

  private recusarPedidoIncompleto(faltaLeiaute: boolean, faltaArquivo: boolean): void {
    if (faltaLeiaute) this.erroDoLeiaute.set('Escolha o leiaute do arquivo de retorno.');
    if (faltaArquivo) this.erroDoArquivo.set('Escolha o arquivo de retorno do INEP.');
    if (faltaLeiaute) {
      this.seletor()?.focar();
    } else {
      this.zonaDeArquivo()?.nativeElement.querySelector<HTMLElement>('button')?.focus();
    }
  }

  private mostrarRecusa(recusa: RecusaExplicada): void {
    this.recusa.set(recusa);
    if (recusa.recarregarCatalogo) this.recarregarCatalogo();
    afterNextRender(() => this.alerta()?.focar(), { injector: this.injector });
  }
}
