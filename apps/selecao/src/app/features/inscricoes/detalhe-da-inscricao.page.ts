import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  ArquivoAdministrativoDto,
  InscricaoAdministrativaDto,
} from '@uniplus/shared-data/selecao';
import {
  AlertComponent,
  DadoDirective,
  ListaDeDadosComponent,
  PageHeaderComponent,
  SpinnerComponent,
  TagComponent,
  detalheDoArquivoEnviado,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { formatarDataBr } from '@uniplus/shared-utils';

import { AvisoDoCertameComponent } from './aviso-do-certame.component';
import { DetalheDaInscricao } from './detalhe-da-inscricao.service';
import { cursoExibido, type CursoExibido } from './nome-da-oferta';
import {
  RespostasDaInscricaoComponent,
  type PedidoDeRevelacao,
} from './respostas-da-inscricao.component';
import { rotuloDaSituacao, varianteDaSituacao } from './situacao-da-inscricao';
import { rotuloDaSituacaoDoArquivo, varianteDaSituacaoDoArquivo } from './situacao-do-arquivo';

/** O que a lista de um arquivo mostra e o nome acessível do "Abrir" dele. */
interface ArquivoExibido {
  readonly id: string;
  readonly nome: string;
  readonly situacao: string;
  readonly detalhe: string;
  readonly nomeDoAbrir: string;
}

/** Os campos do painel de identificação; `null` é o que a API não devolveu. */
interface IdentificacaoExibida {
  readonly numero: string | null;
  readonly situacao: string | null;
  readonly primeiraOpcao: CursoExibido | null;
  readonly segundaOpcao: CursoExibido | null;
  readonly enviadaEm: string | null;
  readonly canceladaEm: string | null;
  readonly motivoDoCancelamento: string | null;
}

/** A recusa ao abrir um arquivo, junto do arquivo a que se refere. */
interface RecusaAoAbrir {
  readonly arquivoId: string;
  readonly mensagem: string;
}

/** A ocorrência de grupo repetível que o detalhe devolveu: o rótulo do grupo e a posição nele. */
interface OcorrenciaConhecida {
  readonly grupo: string;
  readonly ordem: number;
}

/** Onde o arquivo está entre os da mesma exigência e da mesma ocorrência de grupo. */
interface PosicaoDoArquivo {
  readonly posicao: number;
  readonly total: number;
  /** A ocorrência, só quando o detalhe a trouxe; ocorrência sem item visível é omitida pela API. */
  readonly ocorrencia: OcorrenciaConhecida | null;
}

function arquivoExibido(
  arquivo: ArquivoAdministrativoDto,
  lugar: PosicaoDoArquivo,
): ArquivoExibido {
  const enviadoEm = formatarDataBr(arquivo.confirmadoEm, 'datetime');
  // O grupo junto da ordem evita o mesmo nome para a ocorrência 1 de dois grupos diferentes.
  const documento =
    lugar.ocorrencia === null
      ? arquivo.nomeDoDocumento
      : `${arquivo.nomeDoDocumento} (${lugar.ocorrencia.grupo}, ocorrência ${lugar.ocorrencia.ordem})`;
  // O mesmo documento pode ter vários arquivos: a posição entre eles distingue o nome mesmo quando
  // a data é igual ou inválida.
  const nomeDoAbrir = [
    `Abrir ${documento}`,
    lugar.total > 1 ? `arquivo ${lugar.posicao} de ${lugar.total}` : null,
    enviadoEm === '' ? null : `enviado em ${enviadoEm}`,
  ]
    .filter((parte) => parte !== null)
    .join(', ');
  return {
    id: arquivo.arquivoId,
    nome: documento,
    situacao: arquivo.situacao,
    detalhe: detalheDoArquivoEnviado(arquivo),
    nomeDoAbrir,
  };
}

/** Cada ocorrência de grupo repetível que o detalhe devolveu, pelo id da ocorrência. */
function ocorrenciasConhecidas(
  inscricao: InscricaoAdministrativaDto,
): ReadonlyMap<string, OcorrenciaConhecida> {
  const conhecidas = new Map<string, OcorrenciaConhecida>();
  for (const secao of inscricao.secoes) {
    for (const grupo of secao.grupos) {
      grupo.ocorrencias.forEach((o, indice) =>
        conhecidas.set(o.id, { grupo: grupo.rotulo, ordem: indice + 1 }),
      );
    }
  }
  return conhecidas;
}

/**
 * Os arquivos na ordem da API, cada um com a posição entre os da mesma exigência e ocorrência. A
 * ocorrência só é nomeada quando o detalhe a trouxe. A que a API omitiu, por não ter item visível,
 * não ganha número, e todos os arquivos de ocorrências omitidas da mesma exigência contam juntos:
 * "arquivo 1 de 2" e "arquivo 2 de 2" os distinguem mesmo com a mesma data.
 */
function arquivosExibidos(inscricao: InscricaoAdministrativaDto | null): ArquivoExibido[] {
  const arquivos = inscricao?.arquivos ?? [];
  const conhecidas =
    inscricao === null ? new Map<string, OcorrenciaConhecida>() : ocorrenciasConhecidas(inscricao);
  const chave = (a: ArquivoAdministrativoDto): string => {
    if (a.ocorrenciaId == null) return `${a.exigenciaId}|`;
    return conhecidas.has(a.ocorrenciaId)
      ? `${a.exigenciaId}|${a.ocorrenciaId}`
      : `${a.exigenciaId}|omitida`;
  };
  const total = new Map<string, number>();
  for (const a of arquivos) total.set(chave(a), (total.get(chave(a)) ?? 0) + 1);

  const visto = new Map<string, number>();
  return arquivos.map((a) => {
    const posicao = (visto.get(chave(a)) ?? 0) + 1;
    visto.set(chave(a), posicao);
    const ocorrencia = a.ocorrenciaId == null ? null : (conhecidas.get(a.ocorrenciaId) ?? null);
    return arquivoExibido(a, { posicao, total: total.get(chave(a)) ?? 1, ocorrencia });
  });
}

/**
 * O detalhe de uma inscrição enviada, para quem opera o processo, com os arquivos que o candidato
 * enviou.
 *
 * Mostra só o que a API devolve: a visibilidade de cada item é decisão dela, e a tela não a deduz de
 * permissão. Item omitido não aparece e não deixa marca — nem o painel que ficaria sem conteúdo.
 */
@Component({
  selector: 'sel-detalhe-da-inscricao',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    AlertComponent,
    AvisoDoCertameComponent,
    DadoDirective,
    DateBrPipe,
    ListaDeDadosComponent,
    PageHeaderComponent,
    RespostasDaInscricaoComponent,
    SpinnerComponent,
    TagComponent,
  ],
  providers: [DetalheDaInscricao],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-page-header [heading]="titulo()" [description]="descricaoDoCabecalho()">
      <div uiPageActions class="insc-det__acoes">
        <a
          class="btn btn--tertiary"
          [routerLink]="['/processo-seletivo', detalhe.processoId(), 'inscricoes']"
        >
          Voltar às inscrições
        </a>
      </div>
    </ui-page-header>

    @let situacao = detalhe.situacao();
    <p class="insc-det__lendo" role="status">
      @if (detalhe.carregando()) {
        <ui-spinner spinnerSize="sm" />
        Carregando a inscrição
      }
    </p>
    @switch (situacao.estado) {
      @case ('nao-encontrada') {
        <ui-alert variant="danger" heading="Inscrição não encontrada">
          A inscrição não existe neste processo seletivo ou não está disponível para você.
        </ui-alert>
      }
      @case ('falha') {
        <ui-alert variant="danger" heading="Não foi possível carregar a inscrição">
          {{ situacao.mensagem }}
          <span class="insc-det__tentar">
            <button
              type="button"
              class="btn btn--secondary btn--sm"
              [disabled]="detalhe.carregando()"
              (click)="detalhe.tentarNovamente()"
            >
              Tentar novamente
            </button>
          </span>
        </ui-alert>
      }
      @case ('lida') {
        @if (detalhe.situacaoDoCertame() === 'falha') {
          <sel-aviso-do-certame
            [carregando]="detalhe.carregandoCertame()"
            (tentar)="detalhe.recarregarCertame()"
          />
        }

        @if (inscricao(); as insc) {
          @if (identificacao(); as ident) {
            <section class="panel" aria-labelledby="insc-det-identificacao">
              <div class="panel-head">
                <div class="panel-head__title">
                  <h2 id="insc-det-identificacao">Inscrição</h2>
                </div>
              </div>
              <div class="insc-det__corpo">
                <ng-template #nomeDoCurso let-curso>
                  @if (curso.texto !== null) {
                    {{ curso.texto }}
                  } @else {
                    <ui-spinner spinnerSize="sm" />
                    <span class="sr-only">Carregando o nome do curso</span>
                  }
                </ng-template>
                <ui-lista-de-dados [colunas]="2">
                  @if (ident.numero; as numero) {
                    <ng-template uiDado rotulo="Número" [valor]="numero" />
                  }
                  @if (ident.situacao; as situacaoDaInscricao) {
                    <ng-template uiDado rotulo="Situação">
                      <ui-tag [variant]="varianteDaSituacao(situacaoDaInscricao)">
                        {{ rotuloDaSituacao(situacaoDaInscricao) }}
                      </ui-tag>
                    </ng-template>
                  }
                  @if (ident.primeiraOpcao; as curso) {
                    <ng-template uiDado rotulo="1ª opção de curso">
                      <ng-container
                        *ngTemplateOutlet="nomeDoCurso; context: { $implicit: curso }"
                      />
                    </ng-template>
                  }
                  @if (ident.segundaOpcao; as curso) {
                    <ng-template uiDado rotulo="2ª opção de curso">
                      <ng-container
                        *ngTemplateOutlet="nomeDoCurso; context: { $implicit: curso }"
                      />
                    </ng-template>
                  }
                  @if (ident.enviadaEm; as enviadaEm) {
                    <ng-template uiDado rotulo="Enviada em">
                      {{ enviadaEm | dateBr: 'datetime' }}
                    </ng-template>
                  }
                  @if (ident.canceladaEm; as canceladaEm) {
                    <ng-template uiDado rotulo="Cancelada em">
                      {{ canceladaEm | dateBr: 'datetime' }}
                    </ng-template>
                  }
                  @if (ident.motivoDoCancelamento; as motivo) {
                    <ng-template uiDado rotulo="Motivo do cancelamento" [valor]="motivo" />
                  }
                </ui-lista-de-dados>
              </div>
            </section>
          }

          @if (temRespostas()) {
            <section class="panel" aria-labelledby="insc-det-respostas">
              <div class="panel-head">
                <div class="panel-head__title">
                  <h2 id="insc-det-respostas">Respostas do formulário</h2>
                </div>
              </div>
              <div class="insc-det__corpo">
                @for (secao of insc.secoes; track $index) {
                  @if (secao.itens.length > 0 || secao.grupos.length > 0) {
                    @let posicao = $index;
                    @let tituloDaSecao = secao.titulo?.trim();
                    @let nivel = tituloDaSecao ? 4 : 3;
                    @if (tituloDaSecao) {
                      <h3 class="insc-det__secao-titulo">{{ tituloDaSecao }}</h3>
                    }
                    @if (secao.itens.length > 0) {
                      <sel-respostas-da-inscricao
                        [itens]="secao.itens"
                        [revelacoes]="detalhe.revelacoes()"
                        (revelar)="revelar($event)"
                        (ocultar)="ocultar($event)"
                      />
                    }
                    @for (grupo of secao.grupos; track grupo.codigo) {
                      <section
                        class="insc-det__grupo"
                        [attr.aria-labelledby]="'insc-det-grupo-' + posicao + '-' + grupo.codigo"
                      >
                        <div
                          role="heading"
                          class="insc-det__grupo-titulo"
                          [attr.aria-level]="nivel"
                          [id]="'insc-det-grupo-' + posicao + '-' + grupo.codigo"
                        >
                          {{ grupo.rotulo }}
                        </div>
                        @for (ocorrencia of grupo.ocorrencias; track ocorrencia.id) {
                          <div
                            role="heading"
                            class="insc-det__ocorrencia-titulo"
                            [attr.aria-level]="nivel + 1"
                          >
                            {{ $index + 1 }}ª ocorrência
                          </div>
                          <sel-respostas-da-inscricao
                            [itens]="ocorrencia.itens"
                            [ocorrenciaId]="ocorrencia.id"
                            [revelacoes]="detalhe.revelacoes()"
                            (revelar)="revelar($event)"
                            (ocultar)="ocultar($event)"
                          />
                        }
                      </section>
                    }
                  }
                }
              </div>
            </section>
          }

          @if (insc.derivados.length > 0) {
            <section class="panel" aria-labelledby="insc-det-derivados">
              <div class="panel-head">
                <div class="panel-head__title">
                  <h2 id="insc-det-derivados">Calculado pelo sistema</h2>
                </div>
              </div>
              <div class="insc-det__corpo">
                <sel-respostas-da-inscricao
                  [itens]="insc.derivados"
                  [revelacoes]="detalhe.revelacoes()"
                  (revelar)="revelar($event)"
                  (ocultar)="ocultar($event)"
                />
              </div>
            </section>
          }

          @if (arquivos().length > 0) {
            <section class="panel" aria-labelledby="insc-det-arquivos">
              <div class="panel-head">
                <div class="panel-head__title">
                  <h2 id="insc-det-arquivos">Arquivos enviados</h2>
                </div>
              </div>
              <ul class="insc-det__arquivos" role="list">
                @for (arquivo of arquivos(); track arquivo.id) {
                  <li class="insc-det__arquivo">
                    <div class="insc-det__arquivo-cabeca">
                      <div>
                        <p class="insc-det__arquivo-nome">{{ arquivo.nome }}</p>
                        <p class="insc-det__arquivo-detalhe">{{ arquivo.detalhe }}</p>
                      </div>
                      <ui-tag [variant]="varianteDaSituacaoDoArquivo(arquivo.situacao)">
                        {{ rotuloDaSituacaoDoArquivo(arquivo.situacao) }}
                      </ui-tag>
                      <button
                        type="button"
                        class="btn btn--secondary btn--sm"
                        [attr.aria-label]="arquivo.nomeDoAbrir"
                        [disabled]="abrindo() !== null"
                        (click)="abrir(arquivo.id)"
                      >
                        Abrir
                      </button>
                    </div>
                    @if (recusa(); as recusada) {
                      @if (recusada.arquivoId === arquivo.id) {
                        <ui-alert variant="danger" [heading]="recusada.mensagem">
                          Não foi possível abrir {{ arquivo.nome }}.
                        </ui-alert>
                      }
                    }
                  </li>
                }
              </ul>
            </section>
          }
        }
      }
    }
  `,
  styleUrl: './detalhe-da-inscricao.page.css',
  host: { class: 'cfg-page' },
})
export class DetalheDaInscricaoPage {
  private readonly rota = inject(ActivatedRoute);
  protected readonly detalhe = inject(DetalheDaInscricao);

  protected readonly rotuloDaSituacao = rotuloDaSituacao;
  protected readonly varianteDaSituacao = varianteDaSituacao;
  protected readonly rotuloDaSituacaoDoArquivo = rotuloDaSituacaoDoArquivo;
  protected readonly varianteDaSituacaoDoArquivo = varianteDaSituacaoDoArquivo;

  protected readonly abrindo = signal<string | null>(null);
  protected readonly recusa = signal<RecusaAoAbrir | null>(null);

  protected readonly inscricao = this.detalhe.inscricao;

  /** Só com a inscrição em tela o cabeçalho a descreve como enviada; sem ela, só situa o processo. */
  protected readonly descricaoDoCabecalho = computed(() => {
    const processo = this.detalhe.nomeDoProcesso();
    if (this.inscricao() === null) return processo ?? '';
    return processo !== null
      ? `${processo} — inscrição enviada neste processo seletivo.`
      : 'Inscrição enviada neste processo seletivo.';
  });

  protected readonly titulo = computed(() => {
    const numero = this.inscricao()?.numeroInscricao;
    return numero ? `Inscrição ${numero}` : 'Inscrição';
  });

  /**
   * O que o painel de identificação mostra, cada campo só quando a API o devolveu; `null` quando
   * nenhum veio e o painel não existe.
   */
  protected readonly identificacao = computed<IdentificacaoExibida | null>(() => {
    const i = this.inscricao();
    if (i === null) return null;
    const situacao = this.detalhe.situacaoDoCertame();
    const nomes = this.detalhe.nomesDasOfertas();
    const campos: IdentificacaoExibida = {
      numero: i.numeroInscricao || null,
      situacao: i.situacao ?? null,
      primeiraOpcao: cursoExibido(situacao, nomes, i.ofertaCursoId),
      segundaOpcao: cursoExibido(situacao, nomes, i.ofertaCursoSegundaOpcaoId),
      enviadaEm: i.submetidaEm ?? null,
      canceladaEm: i.canceladaEm ?? null,
      motivoDoCancelamento: i.motivoDoCancelamento || null,
    };
    return Object.values(campos).some((valor) => valor !== null) ? campos : null;
  });

  protected readonly arquivos = computed(() => arquivosExibidos(this.inscricao()));

  protected readonly temRespostas = computed(() =>
    (this.inscricao()?.secoes ?? []).some((s) => s.itens.length > 0 || s.grupos.length > 0),
  );

  constructor() {
    this.rota.paramMap.pipe(takeUntilDestroyed()).subscribe((parametros) => {
      const processo = parametros.get('id');
      const inscricao = parametros.get('inscricaoId');
      if (processo === null || inscricao === null) return;
      this.recusa.set(null);
      this.abrindo.set(null);
      this.detalhe.abrir(processo, inscricao);
    });
  }

  protected ocultar(pedido: PedidoDeRevelacao): void {
    this.detalhe.ocultar(pedido.fatoCodigo, pedido.ocorrenciaId);
  }

  protected revelar(pedido: PedidoDeRevelacao): void {
    void this.detalhe.revelar(pedido.fatoCodigo, pedido.ocorrenciaId);
  }

  /** Tem de rodar dentro do clique: a aba do arquivo nasce antes do primeiro `await`. */
  protected async abrir(arquivoId: string): Promise<void> {
    if (this.abrindo() !== null) return;
    this.recusa.set(null);
    this.abrindo.set(arquivoId);
    try {
      const desfecho = await this.detalhe.abrirArquivo(arquivoId);
      if (desfecho.situacao === 'recusado') {
        this.recusa.set({ arquivoId, mensagem: desfecho.mensagem });
      }
    } finally {
      // Na troca de inscrição `abrindo` já foi zerado e pode ser de outro pedido.
      if (this.abrindo() === arquivoId) this.abrindo.set(null);
    }
  }
}
