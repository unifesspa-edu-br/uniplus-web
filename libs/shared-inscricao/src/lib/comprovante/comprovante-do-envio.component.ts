import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  contentChild,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, type Observable, of, switchMap, tap } from 'rxjs';
import { type ApiResult, ProblemI18nService } from '@uniplus/shared-core/http';
import type { ComprovanteDaInscricaoDto } from '@uniplus/shared-data/selecao';
import {
  acompanharLeitura,
  AlertComponent,
  DocumentoComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SkeletonComponent,
} from '@uniplus/shared-ui/components';
import { type DadoRevelavel, textoMascarado } from '@uniplus/shared-utils';

import { AcaoDaCorrecaoDirective } from './acao-da-correcao.directive';
import { ComprovanteDaInscricaoComponent } from './comprovante-da-inscricao.component';
import type { RecusaDoComprovante, RecusasDoComprovante } from './recusas-do-comprovante';

/** De onde o app lê o comprovante do envio de um número, a contar de 1. */
export type FonteDoComprovante = (
  numero: number,
) => Observable<ApiResult<ComprovanteDaInscricaoDto>>;

type Leitura =
  | { readonly tipo: 'pronto'; readonly comprovante: ComprovanteDaInscricaoDto }
  | { readonly tipo: 'recusa'; readonly recusa: RecusaDoComprovante }
  | { readonly tipo: 'falha'; readonly mensagem: string };

type Estado = 'carregando' | 'erro' | 'recusado' | 'pronto';

/**
 * A exibição do comprovante de um envio da inscrição, igual para quem se inscreveu e para quem opera
 * o processo: lê pela fonte do app, explica a recusa com os textos dele e entrega o documento ao corpo
 * (`insc-comprovante-da-inscricao`), que só exibe. É o dono do `ui-documento`, da ação de imprimir, do
 * aviso de validade, do alerta de envio substituído e do foco no título.
 *
 * O que é de cada app entra por projeção: `[inscAcaoDoDocumento]` fica nas ações do documento e
 * o `ng-template[inscAcaoDaCorrecao]` em "Prazo para correção", quando o prazo está aberto.
 */
@Component({
  selector: 'insc-comprovante-do-envio',
  standalone: true,
  imports: [
    AlertComponent,
    ComprovanteDaInscricaoComponent,
    DocumentoComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    NgTemplateOutlet,
    RouterLink,
    SkeletonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './comprovante-do-envio.component.html',
})
export class ComprovanteDoEnvioComponent {
  private readonly problemas = inject(ProblemI18nService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tentativa = signal(0);
  private readonly documento = viewChild.required(DocumentoComponent);
  protected readonly acaoDaCorrecao = contentChild(AcaoDaCorrecaoDirective);

  readonly fonte = input.required<FonteDoComprovante>();
  /** A ordem do envio, como veio do endereço. */
  readonly numero = input.required<string>();
  readonly recusas = input.required<RecusasDoComprovante>();
  readonly rotaDoEnvio = input.required<(numero: number) => readonly unknown[]>();
  readonly titulo = input.required<string>();
  readonly descricao = input.required<string>();
  /** O CPF de quem está logado, revelável; só vale se confere com o do comprovante. */
  readonly cpf = input<DadoRevelavel | null>(null);

  protected readonly estado = signal<Estado>('carregando');
  protected readonly erro = signal<string | null>(null);
  protected readonly recusa = signal<RecusaDoComprovante | null>(null);
  protected readonly comprovante = signal<ComprovanteDaInscricaoDto | null>(null);
  protected readonly leitura = acompanharLeitura({
    falha: computed(() => (this.estado() === 'erro' ? this.erro() : null)),
    pendente: computed(() => this.estado() === 'carregando'),
    recarregar: () => this.carregar(),
    destino: () => this.host.nativeElement.querySelector('h1'),
    recusada: computed(() => this.estado() === 'recusado'),
  });

  /** O aviso do documento só vale com o comprovante à mostra: numa recusa, o anterior já não é o da tela. */
  protected readonly aviso = computed(() =>
    this.estado() === 'pronto' ? (this.comprovante()?.cancelamento?.aviso ?? null) : null,
  );

  /** O titular confere o próprio CPF; para qualquer outra pessoa, fica o mascarado que a API entregou. */
  protected readonly cpfConferido = computed(() => {
    const doLogin = this.cpf();
    const mascarado = this.comprovante()?.candidato.cpfMascarado;
    return doLogin?.revelado && textoMascarado(doLogin) === mascarado ? doLogin : null;
  });

  constructor() {
    // A rota reaproveita a página quando só o número muda: a leitura segue as entradas.
    toObservable(
      computed(() => ({ fonte: this.fonte(), numero: this.numero(), tentativa: this.tentativa() })),
    )
      .pipe(
        tap(() => this.estado.set('carregando')),
        switchMap(({ fonte, numero }) => this.ler(fonte, numero)),
        takeUntilDestroyed(),
      )
      .subscribe((leitura) => this.mostrar(leitura));
  }

  protected imprimir(): void {
    this.documento().imprimir();
  }

  protected carregar(): void {
    this.tentativa.update((n) => n + 1);
  }

  private ler(fonte: FonteDoComprovante, numeroPedido: string): Observable<Leitura> {
    // O endereço que não traz um inteiro positivo não leva a comprovante algum: nem se pergunta à API.
    const numero = Number(numeroPedido);
    if (!Number.isInteger(numero) || numero < 1) {
      return of({ tipo: 'recusa', recusa: this.recusas().naoEncontrado });
    }
    return fonte(numero).pipe(
      map((resultado): Leitura => {
        if (resultado.ok) return { tipo: 'pronto', comprovante: resultado.data };
        const recusa = this.recusas().explicar(resultado.problem);
        return recusa
          ? { tipo: 'recusa', recusa }
          : { tipo: 'falha', mensagem: this.problemas.resolve(resultado.problem).title };
      }),
    );
  }

  private mostrar(leitura: Leitura): void {
    if (leitura.tipo === 'pronto') this.mostrarPronto(leitura.comprovante);
    else if (leitura.tipo === 'recusa') this.mostrarRecusa(leitura.recusa);
    else this.mostrarFalha(leitura.mensagem);
  }

  private mostrarPronto(comprovante: ComprovanteDaInscricaoDto): void {
    this.comprovante.set(comprovante);
    this.estado.set('pronto');
    // Numa nova tentativa pedida pela pessoa, quem leva o foco ao título (ou anuncia a conclusão,
    // se ela o tirou do botão) é o acompanhamento da leitura; focar aqui também somaria os dois.
    if (this.leitura.fase() !== 'tentando') {
      afterNextRender(() => this.documento().focar(), { injector: this.injector });
    }
  }

  private mostrarRecusa(recusa: RecusaDoComprovante): void {
    this.recusa.set(recusa);
    this.estado.set('recusado');
  }

  private mostrarFalha(mensagem: string): void {
    this.erro.set(mensagem);
    this.estado.set('erro');
  }
}
