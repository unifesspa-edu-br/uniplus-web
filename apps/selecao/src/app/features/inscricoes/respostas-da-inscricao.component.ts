import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import type { ItemDeRespostaDto } from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  DadoDirective,
  ListaDeDadosComponent,
  TagComponent,
  ValorApresentadoComponent,
  type UiValorEmConsulta,
} from '@uniplus/shared-ui/components';

import {
  DADO_NAO_DISPONIVEL,
  chaveDoCampo,
  type RevelacaoDoCampo,
} from './detalhe-da-inscricao.service';
import { rotuloDaSituacao, varianteDaSituacao } from './situacao-da-inscricao';
import { valorExibido } from './valor-da-resposta';

/** O pedido de revelar um campo: o fato e, quando o item está em grupo, a ocorrência. */
export interface PedidoDeRevelacao {
  readonly fatoCodigo: string;
  readonly ocorrenciaId: string | null;
}

/** Uma resposta pronta para a lista: o endereço sai em linhas, a situação em etiqueta; o resto, pelo valor em consulta. */
interface RespostaExibida {
  readonly chave: string;
  readonly fatoCodigo: string;
  readonly rotulo: string;
  readonly descricao: string;
  readonly podeRevelar: boolean;
  readonly linhas: readonly string[] | null;
  readonly situacao: string | null;
  readonly valor: UiValorEmConsulta;
  /** A forma mascarada, a única que vai para o papel. */
  readonly mascarado: UiValorEmConsulta;
  readonly revelacao: RevelacaoDoCampo | null;
  readonly aviso: string;
}

function avisoDa(revelacao: RevelacaoDoCampo | null, rotulo: string): string {
  if (revelacao?.estado === 'revelado') return `${rotulo} revelado`;
  if (revelacao?.estado === 'indisponivel') return DADO_NAO_DISPONIVEL;
  return revelacao?.estado === 'falha' ? revelacao.mensagem : '';
}

function respostaExibida(
  item: ItemDeRespostaDto,
  ocorrenciaId: string | null,
  revelacao: RevelacaoDoCampo | null,
): RespostaExibida {
  const base = {
    chave: chaveDoCampo(item.fatoCodigo, ocorrenciaId),
    fatoCodigo: item.fatoCodigo,
    rotulo: item.rotulo,
    descricao: item.descricao,
    podeRevelar: item.podeRevelar,
    revelacao,
    aviso: avisoDa(revelacao, item.rotulo),
  };
  const original = valorExibido(item.tipo, item.valor, item.componente);
  const mascarado = 'valor' in original ? original.valor : null;
  const valor = revelacao?.estado === 'revelado' ? revelacao.valor : item.valor;
  const exibido = valorExibido(item.tipo, valor, item.componente);
  const pronto = { ...base, mascarado };
  if ('linhas' in exibido)
    return { ...pronto, linhas: exibido.linhas, situacao: null, valor: null };
  if ('situacao' in exibido) {
    return { ...pronto, linhas: null, situacao: exibido.situacao, valor: null };
  }
  return { ...pronto, linhas: null, situacao: null, valor: exibido.valor };
}

/**
 * As respostas de uma inscrição como lista de dados: o rótulo, o valor segundo o componente e o
 * `tipo`, e a descrição do campo como dica, em texto visível, que o teclado, o leitor de tela e o
 * toque alcançam do mesmo jeito. Mostra só os itens que recebe. A ação "Revelar" aparece no item
 * que a API marca com `podeRevelar`, e só nele; o valor revelado substitui o mascarado naquele
 * campo e vive no estado da página do detalhe.
 */
@Component({
  selector: 'sel-respostas-da-inscricao',
  standalone: true,
  imports: [
    AlertComponent,
    DadoDirective,
    ListaDeDadosComponent,
    TagComponent,
    ValorApresentadoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-lista-de-dados [colunas]="2">
      @for (resposta of respostas(); track resposta.chave) {
        <ng-template uiDado [rotulo]="resposta.rotulo">
          <span
            class="resposta__valor"
            [attr.data-chave]="resposta.chave"
            [attr.tabindex]="resposta.podeRevelar ? -1 : null"
          >
            <span [class.u-no-print]="resposta.revelacao?.estado === 'revelado'">
              @if (resposta.linhas; as linhas) {
                @for (linha of linhas; track $index) {
                  <span class="resposta__linha">{{ linha }}</span>
                }
              } @else if (resposta.situacao; as situacao) {
                <ui-tag [variant]="varianteDaSituacao(situacao)">{{
                  rotuloDaSituacao(situacao)
                }}</ui-tag>
              } @else {
                <ui-valor-apresentado [valor]="resposta.valor" />
              }
            </span>
            @if (resposta.revelacao?.estado === 'revelado') {
              <span class="u-print-only" aria-hidden="true">
                <ui-valor-apresentado [valor]="resposta.mascarado" />
              </span>
            }
          </span>
          @if (resposta.podeRevelar) {
            @switch (resposta.revelacao?.estado) {
              @case ('revelado') {
                <button
                  type="button"
                  class="btn btn--tertiary btn--sm resposta__revelar u-no-print"
                  [attr.aria-label]="'Ocultar ' + resposta.rotulo"
                  (click)="ocultarCampo(resposta)"
                >
                  Ocultar
                </button>
              }
              @case ('indisponivel') {}
              @default {
                <button
                  type="button"
                  class="btn btn--secondary btn--sm resposta__revelar u-no-print"
                  [attr.data-revelar]="resposta.chave"
                  [attr.aria-label]="'Revelar ' + resposta.rotulo"
                  [attr.aria-disabled]="resposta.revelacao?.estado === 'pendente' ? 'true' : null"
                  (click)="revelarCampo(resposta)"
                >
                  Revelar
                </button>
              }
            }
            <div
              class="resposta__aviso"
              [class.sr-only]="resposta.revelacao?.estado === 'revelado'"
              [attr.data-aviso]="resposta.chave"
              tabindex="-1"
              aria-live="polite"
            >
              @if (resposta.revelacao?.estado === 'indisponivel') {
                <ui-alert variant="info" [dynamic]="false">{{ resposta.aviso }}</ui-alert>
              } @else if (resposta.revelacao?.estado === 'falha') {
                <ui-alert variant="danger" [dynamic]="false">{{ resposta.aviso }}</ui-alert>
              } @else {
                {{ resposta.aviso }}
              }
            </div>
          }
          @if (resposta.descricao) {
            <small class="resposta__dica">{{ resposta.descricao }}</small>
          }
        </ng-template>
      }
    </ui-lista-de-dados>
  `,
  styles: `
    .resposta__linha {
      display: block;
      overflow-wrap: anywhere;
    }
    .resposta__revelar {
      margin-inline-start: var(--space-2);
    }
    .resposta__aviso {
      display: block;
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }
    .resposta__dica {
      display: block;
      margin-top: var(--space-1);
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }
  `,
})
export class RespostasDaInscricaoComponent {
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private estados: ReadonlyMap<string, RevelacaoDoCampo['estado']> | null = null;

  readonly itens = input.required<readonly ItemDeRespostaDto[]>();
  /** A ocorrência do grupo a que os itens pertencem; ausente fora de grupo. */
  readonly ocorrenciaId = input<string | null>(null);
  /** Onde a revelação de cada campo está, por fato e ocorrência. */
  readonly revelacoes = input<ReadonlyMap<string, RevelacaoDoCampo>>(new Map());
  readonly revelar = output<PedidoDeRevelacao>();
  readonly ocultar = output<PedidoDeRevelacao>();

  protected readonly rotuloDaSituacao = rotuloDaSituacao;
  protected readonly varianteDaSituacao = varianteDaSituacao;

  protected readonly respostas = computed(() => {
    const ocorrencia = this.ocorrenciaId();
    const revelacoes = this.revelacoes();
    return this.itens().map((item) =>
      respostaExibida(
        item,
        ocorrencia,
        revelacoes.get(chaveDoCampo(item.fatoCodigo, ocorrencia)) ?? null,
      ),
    );
  });

  constructor() {
    effect(() => {
      const agora = new Map(
        this.respostas().flatMap((r) =>
          r.revelacao ? [[r.chave, r.revelacao.estado] as const] : [],
        ),
      );
      const antes = this.estados;
      this.estados = agora;
      for (const [chave, estado] of agora) {
        const terminou = estado === 'revelado' || estado === 'indisponivel';
        if (antes?.get(chave) === 'pendente' && terminou && this.focoEstaNoBotao(chave)) {
          const atributo = estado === 'revelado' ? 'data-chave' : 'data-aviso';
          afterNextRender(() => this.focar(atributo, chave), { injector: this.injector });
          return;
        }
      }
    });
  }

  /** Só quem ainda está no botão "Revelar" do campo, quando a resposta chega, tem o foco levado adiante. */
  private focoEstaNoBotao(chave: string): boolean {
    const botoes = this.raiz.nativeElement.querySelectorAll<HTMLElement>('[data-revelar]');
    const botao = Array.from(botoes).find((b) => b.dataset['revelar'] === chave);
    return botao !== undefined && botao === document.activeElement;
  }

  /** O botão sai da tela; o foco segue para o valor revelado, o aviso ou o botão que volta, em vez de cair no corpo da página. */
  private focar(atributo: 'data-chave' | 'data-aviso' | 'data-revelar', chave: string): void {
    const alvos = this.raiz.nativeElement.querySelectorAll<HTMLElement>(`[${atributo}]`);
    Array.from(alvos)
      .find((alvo) => alvo.getAttribute(atributo) === chave)
      ?.focus();
  }

  protected revelarCampo(resposta: RespostaExibida): void {
    if (resposta.revelacao?.estado === 'pendente') return;
    this.revelar.emit({ fatoCodigo: resposta.fatoCodigo, ocorrenciaId: this.ocorrenciaId() });
  }

  protected ocultarCampo(resposta: RespostaExibida): void {
    this.ocultar.emit({ fatoCodigo: resposta.fatoCodigo, ocorrenciaId: this.ocorrenciaId() });
    afterNextRender(() => this.focar('data-revelar', resposta.chave), { injector: this.injector });
  }
}
