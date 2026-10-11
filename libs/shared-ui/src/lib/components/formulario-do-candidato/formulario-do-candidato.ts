import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  Injector,
  inject,
  input,
  linkedSignal,
  output,
  untracked,
  viewChild,
} from '@angular/core';

import { AlertComponent } from '../alert/alert';
import {
  type DocumentoExigido,
  ListaDeDocumentosComponent,
} from '../lista-de-documentos/lista-de-documentos';
import { CampoDoCandidatoComponent } from './campo-do-candidato';
import {
  BLOCO_COMPROVACAO_DOCUMENTAL,
  BLOCO_MODALIDADES_CALCULADAS,
  BLOCO_REVISAO_E_ACEITE,
  campoEm,
  type CampoNoPasso,
  type ErroDoServidor,
  erroEm,
  fatoDaUf,
  type FormularioDoCandidato,
  mensagemDosErros,
  type PassoDoFormulario,
  type RespostaFixa,
  type TermoNoPasso,
  passosDo,
  pendenciasDo,
  termoSemAceite,
} from './formulario-do-candidato.model';
import {
  anunciarMudancaDosDocumentos,
  arvoreDeDocumentos,
  documentosDoFormulario,
  type NoDeDocumentos,
} from './documentos-avaliados';
import { DocumentosDaInscricaoComponent } from './documentos-da-inscricao';
import { GrupoDoCandidatoComponent } from './grupo-do-candidato';
import {
  anunciarMudancaDasModalidades,
  type AvaliacaoNaTela,
  conhecidas,
  type ModalidadesAvaliadas,
  type PendenciaDaAvaliacao,
  secoesQueDefinemAsModalidades,
} from './modalidades-avaliadas';
import { ModalidadesDaInscricaoComponent } from './modalidades-da-inscricao';
import { interpretarFormulario, lerEnvio } from './interpretador/interpretador';
import type {
  EnvioDasRespostas,
  OcorrenciaSimulada,
  SimulacaoDoFormulario,
  ValorJson,
} from './interpretador/regras-do-formulario';

/**
 * O formulário como o candidato o vê, seção a seção, interpretando as regras que a API publica: o que
 * aparece, o que é obrigatório, as opções e as mensagens de cada campo vêm do interpretador, a cada
 * resposta, sem ida à API. Nada é gravado aqui: quem hospeda recebe a simulação a cada mudança e decide
 * o que fazer com ela — conferir com o servidor, exportar, enviar.
 *
 * Avançar dá a seção como concluída, como na inscrição: os obrigatórios sem resposta passam a mostrar a
 * pendência e os opcionais em branco passam a valer como não informados. É o mesmo formulário da
 * simulação e da inscrição do candidato.
 */
@Component({
  selector: 'ui-formulario-do-candidato',
  standalone: true,
  imports: [
    AlertComponent,
    CampoDoCandidatoComponent,
    DocumentosDaInscricaoComponent,
    GrupoDoCandidatoComponent,
    ListaDeDocumentosComponent,
    ModalidadesDaInscricaoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="formulario-candidato">
      <p class="sr-only" aria-live="polite">{{ anuncio() }}</p>
      <!-- Fora da seção dela: a resposta que muda a avaliação é dada em outra seção. -->
      <p class="sr-only" aria-live="polite">{{ anuncioDaAvaliacao() }}</p>

      @if (recusa(); as erro) {
        <ui-alert variant="danger" heading="As regras do formulário não podem ser interpretadas">
          {{ erro.mensagem }} (em {{ erro.caminho }})
        </ui-alert>
      } @else if (passos().length === 0) {
        <ui-alert variant="info" [dynamic]="false">O formulário não tem seção a mostrar.</ui-alert>
      } @else {
        <nav class="formulario-candidato__navegacao" aria-label="Seções do formulário">
          <ol class="formulario-candidato__passos">
            @for (passo of passos(); track passo.chave; let i = $index) {
              <li>
                <button
                  type="button"
                  class="formulario-candidato__passo"
                  [class.is-current]="i === indice()"
                  [class.is-done]="concluido(passo)"
                  [class.is-error]="comErro(passo)"
                  [attr.aria-current]="i === indice() ? 'step' : null"
                  (click)="irPara(i)"
                >
                  <span class="formulario-candidato__passo-numero" aria-hidden="true">{{
                    i + 1
                  }}</span>
                  {{ passo.titulo }}
                  @if (comErro(passo)) {
                    <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
                    <span class="sr-only">(com resposta recusada)</span>
                  } @else if (concluido(passo)) {
                    <span class="sr-only">(concluída)</span>
                  }
                </button>
              </li>
            }
          </ol>
        </nav>

        <!-- Cada partida nova — outro formulário, outra simulação inicial — recria os campos: o que
             se digitou pela metade e a confirmação não passam de uma partida para outra. -->
        @for (partidaAtual of [partida()]; track partidaAtual) {
          @if (passoAtual(); as passo) {
            <section
              class="formulario-candidato__secao"
              [attr.aria-labelledby]="idBase() + '-titulo'"
            >
              <h3
                #titulo
                class="formulario-candidato__titulo"
                tabindex="-1"
                [id]="idBase() + '-titulo'"
              >
                {{ passo.titulo }}
                <span class="sr-only">, seção {{ indice() + 1 }} de {{ passos().length }}</span>
              </h3>
              @if (passo.descricao) {
                <p class="formulario-candidato__descricao">{{ passo.descricao }}</p>
              }
              @if (passo.aviso) {
                <ui-alert variant="warning" [dynamic]="false">{{ passo.aviso }}</ui-alert>
              }

              @switch (passo.bloco) {
                @case (BLOCO_MODALIDADES_CALCULADAS) {
                  @if (avaliacao(); as avaliacao) {
                    <ui-modalidades-da-inscricao
                      [avaliacao]="avaliacao"
                      [secoes]="secoesQueDefinem()"
                      (irAoCampo)="irAoCampo($event)"
                      (irASecao)="irASecao($event)"
                      (tentarDeNovo)="tentarAvaliarDeNovo.emit()"
                    />
                  } @else {
                    <p>
                      As modalidades em que o candidato concorre são calculadas pelo sistema a
                      partir das respostas dadas.
                    </p>
                  }
                }
                @case (BLOCO_COMPROVACAO_DOCUMENTAL) {
                  @if (avaliacao(); as avaliacao) {
                    <ui-documentos-da-inscricao
                      [avaliacao]="avaliacao"
                      [arvore]="documentosDaAvaliacao()?.arvore ?? null"
                      [pendencias]="documentosDaAvaliacao()?.pendencias ?? []"
                      [semDocumentos]="semDocumentos()"
                      (irAoCampo)="irAoCampo($event)"
                      (tentarDeNovo)="tentarAvaliarDeNovo.emit()"
                    />
                  } @else if (documentos(); as lista) {
                    <ui-lista-de-documentos
                      [documentos]="lista"
                      [semDocumentos]="semDocumentos()"
                    />
                  } @else {
                    <p>Os documentos exigidos são listados a partir da publicação do processo.</p>
                  }
                }
              }

              @for (campo of passo.campos; track campo.campo.fatoCodigo) {
                <ui-campo-do-candidato
                  [attr.data-campo]="campo.campo.fatoCodigo"
                  [noPasso]="campo"
                  [id]="idBase() + '-' + campo.campo.fatoCodigo"
                  [resposta]="respostasComAsFixas()[campo.campo.fatoCodigo]"
                  [respostaDaUf]="respostaDaUf(campo)"
                  [mostrarPendencia]="concluido(passo)"
                  [fixa]="respostasFixas()[campo.campo.fatoCodigo] ?? null"
                  [erroDoServidor]="mensagemDosErros(erros(), campo.campo.fatoCodigo)"
                  [diaDoEnvio]="diaDoEnvio()"
                  (respondida)="responder(campo.campo.fatoCodigo, $event)"
                />
              }

              @for (grupo of passo.grupos; track grupo.grupo.codigo) {
                <ui-grupo-do-candidato
                  [attr.data-campo]="grupo.grupo.codigo"
                  [noPasso]="grupo"
                  [id]="idBase() + '-' + grupo.grupo.codigo"
                  [ocorrencias]="grupos()[grupo.grupo.codigo]"
                  [respostasDoCandidato]="respostasComAsFixas()"
                  [mostrarPendencia]="concluido(passo)"
                  [errosDoServidor]="errosEm(grupo.grupo.codigo)"
                  [diaDoEnvio]="diaDoEnvio()"
                  (ocorrenciasChange)="responderGrupo(grupo.grupo.codigo, $event)"
                />
              }

              @if (passo.bloco === BLOCO_REVISAO_E_ACEITE) {
                @if (avaliacaoDerivada(); as avaliacao) {
                  <ui-modalidades-da-inscricao
                    [avaliacao]="avaliacao"
                    [secoes]="secoesQueDefinem()"
                    [resumo]="true"
                    (irAoCampo)="irAoCampo($event)"
                    (irASecao)="irASecao($event)"
                    (tentarDeNovo)="tentarAvaliarDeNovo.emit()"
                  />
                }
                @for (termo of passo.termos; track termo.termo.codigo) {
                  <article
                    class="formulario-candidato__termo"
                    [attr.data-campo]="termo.termo.codigo"
                    [attr.aria-labelledby]="idBase() + '-termo-' + termo.termo.codigo"
                  >
                    <h4 [id]="idBase() + '-termo-' + termo.termo.codigo">{{ termo.termo.nome }}</h4>
                    <p class="formulario-candidato__termo-texto">{{ termo.termo.texto }}</p>
                    <p class="field__hint">Base legal: {{ termo.termo.baseLegal }}</p>
                    <label class="checkbox">
                      <input
                        type="checkbox"
                        [checked]="aceitos().has(termo.termo.codigo)"
                        [attr.aria-invalid]="problemaDoTermo(passo, termo) ? 'true' : null"
                        [attr.aria-describedby]="
                          problemaDoTermo(passo, termo)
                            ? idBase() + '-termo-' + termo.termo.codigo + '-erro'
                            : null
                        "
                        (change)="alternarAceite(termo.termo.codigo, $event)"
                      />
                      <span class="checkbox__box" aria-hidden="true"></span>
                      Li e aceito{{
                        termo.avaliado.obrigatorio === 'VERDADEIRO' ? ' (obrigatório)' : ''
                      }}
                    </label>
                    @if (problemaDoTermo(passo, termo); as problema) {
                      <span
                        class="field__error"
                        [id]="idBase() + '-termo-' + termo.termo.codigo + '-erro'"
                      >
                        {{ problema }}
                      </span>
                    }
                  </article>
                } @empty {
                  <p>Nenhum termo a aceitar.</p>
                }
              }
            </section>

            <div class="formulario-candidato__acoes">
              <button
                type="button"
                class="btn btn--secondary"
                [disabled]="indice() === 0"
                (click)="irPara(indice() - 1)"
              >
                Seção anterior
              </button>
              @if (indice() < passos().length - 1) {
                <button type="button" class="btn btn--primary" (click)="avancar()">
                  Próxima seção
                </button>
              } @else if (concluirNaUltimaSecao()) {
                <button type="button" class="btn btn--primary" (click)="avancar()">
                  Concluir a seção
                </button>
              }
            </div>
          }
        }
      }
    </div>
  `,
})
export class FormularioDoCandidatoComponent {
  private readonly injector = inject(Injector);

  readonly formulario = input.required<FormularioDoCandidato>();
  /** As respostas de partida, como as de um caso importado; recomeça quando muda. */
  readonly inicial = input<SimulacaoDoFormulario | null>(null);
  /** Os fatos que vêm de fora do formulário — respostas de outro formulário, valores calculados. */
  readonly pressupostos = input<Readonly<Record<string, ValorJson>>>({});
  /**
   * A lista do bloco de comprovação documental, como o certame a publica; nula quando quem hospeda não a
   * tem. Com avaliação, o bloco mostra os documentos que ela calcula.
   */
  readonly documentos = input<readonly DocumentoExigido[] | null>(null);
  /** O que o bloco de comprovação documental diz quando a lista é vazia. */
  readonly semDocumentos = input('Nenhum documento é exigido nesta fase.');
  readonly idBase = input<string>('formulario-candidato');
  /** Os termos já aceitos, pelo código, como os de uma inscrição retomada; recomeçam com a partida. */
  readonly termosAceitosIniciais = input<readonly string[]>([]);
  /** As respostas que o candidato não altera, pelo fato. Entram na simulação e o campo só as mostra. */
  readonly respostasFixas = input<Readonly<Partial<Record<string, RespostaFixa>>>>({});
  /**
   * As recusas do servidor. Cada uma aparece ao lado do que recusou e some quando o candidato o muda;
   * uma lista nova leva à seção da primeira e põe o foco nela.
   */
  readonly errosDoServidor = input<readonly ErroDoServidor[]>([]);
  /**
   * Se a última seção tem o botão que a conclui. Quem hospeda uma ação final própria, como o envio da
   * inscrição, o desliga e chama `concluirTodas()` nela.
   */
  readonly concluirNaUltimaSecao = input(true);
  /**
   * O envio contra o qual contam os limites de data: o instante que quem hospeda considera e o fuso
   * que o formulário publica. Sem ele, o limite contado do envio fica indeterminado.
   */
  readonly envio = input<EnvioDasRespostas | null>(null);
  /**
   * O que a API calculou das respostas (ADR-0143). Nula, o bloco de modalidades só explica o cálculo —
   * como no simulador, que não consulta a API. Sem derivação, o bloco de modalidades não aparece.
   */
  readonly avaliacao = input<AvaliacaoNaTela | null>(null);

  /** A simulação a cada mudança: as respostas, as ocorrências, as seções concluídas e os pressupostos. */
  readonly simulacaoChange = output<SimulacaoDoFormulario>();
  /** Os termos aceitos, pelo código, a cada mudança. */
  readonly termosAceitosChange = output<readonly string[]>();
  /** O candidato pediu para calcular de novo a avaliação depois de uma falha. */
  readonly tentarAvaliarDeNovo = output<void>();

  protected readonly BLOCO_MODALIDADES_CALCULADAS = BLOCO_MODALIDADES_CALCULADAS;
  protected readonly BLOCO_COMPROVACAO_DOCUMENTAL = BLOCO_COMPROVACAO_DOCUMENTAL;
  protected readonly BLOCO_REVISAO_E_ACEITE = BLOCO_REVISAO_E_ACEITE;

  protected readonly partida = computed(() => ({
    formulario: this.formulario(),
    inicial: this.inicial(),
    termosAceitos: this.termosAceitosIniciais(),
  }));
  protected readonly respostas = linkedSignal<unknown, Readonly<Record<string, ValorJson>>>({
    source: this.partida,
    computation: () => ({ ...(this.inicial()?.respostas ?? {}) }),
  });
  protected readonly grupos = linkedSignal<
    unknown,
    Readonly<Record<string, readonly OcorrenciaSimulada[]>>
  >({
    source: this.partida,
    computation: () =>
      Object.fromEntries(
        Object.entries(this.inicial()?.grupos ?? {}).map(([codigo, lista]) => [
          codigo,
          lista ?? [],
        ]),
      ),
  });
  private readonly concluidas = linkedSignal<unknown, ReadonlySet<string>>({
    source: this.partida,
    computation: () => new Set(this.inicial()?.etapasConcluidas ?? []),
  });
  /**
   * A seção escolhida, pela chave: a resposta que esconde ou mostra outra seção não troca a seção em
   * que o candidato está. Se a escolhida some, fica a da mesma posição.
   */
  private readonly escolhida = linkedSignal<unknown, { chave: string | null; indice: number }>({
    source: this.partida,
    computation: () => ({ chave: null, indice: 0 }),
  });
  /** Os blocos do sistema dados como concluídos, pela chave do passo: eles não têm etapa nas regras. */
  private readonly blocosConcluidos = linkedSignal<unknown, ReadonlySet<string>>({
    source: this.partida,
    computation: () => new Set(),
  });
  /** Os termos aceitos. O aceite não é fato das regras: não entra na simulação. */
  protected readonly aceitos = linkedSignal<unknown, ReadonlySet<string>>({
    source: this.partida,
    computation: () => new Set(this.termosAceitosIniciais()),
  });
  /** Os termos aceitos agora, pelo código — o que se lê para gravar, sem esperar a próxima emissão. */
  readonly termosAceitos = computed<readonly string[]>(() => [...this.aceitos()]);
  /** As recusas do servidor que ainda valem: a resposta mudada leva a dela. */
  protected readonly erros = linkedSignal<readonly ErroDoServidor[], readonly ErroDoServidor[]>({
    source: this.errosDoServidor,
    computation: (erros) => erros,
  });

  protected readonly respostasComAsFixas = computed<Readonly<Record<string, ValorJson>>>(() => ({
    ...this.respostas(),
    ...Object.fromEntries(
      Object.entries(this.respostasFixas()).flatMap(([fato, f]) => (f ? [[fato, f.valor]] : [])),
    ),
  }));

  readonly simulacao = computed<SimulacaoDoFormulario>(() => ({
    respostas: this.respostasComAsFixas(),
    grupos: this.grupos(),
    etapasConcluidas: [...this.concluidas()],
    pressupostos: this.pressupostos(),
    envio: this.envio(),
  }));
  /** O dia do envio, que os campos de data usam para dizer os limites; nulo sem envio que valha. */
  protected readonly diaDoEnvio = computed(() => {
    const dia = lerEnvio(this.envio());
    return typeof dia === 'string' ? dia : null;
  });

  private readonly interpretacao = computed(() =>
    interpretarFormulario(this.formulario().regras, this.simulacao()),
  );
  protected readonly recusa = computed(() => {
    const interpretacao = this.interpretacao();
    return interpretacao.valida ? null : interpretacao.erro;
  });
  protected readonly passos = computed<readonly PassoDoFormulario[]>(() => {
    const interpretacao = this.interpretacao();
    if (!interpretacao.valida) return [];
    const passos = passosDo(this.formulario(), interpretacao.avaliacao);
    return this.semDerivacao()
      ? passos.filter((p) => p.bloco !== BLOCO_MODALIDADES_CALCULADAS)
      : passos;
  });
  /** O processo que não define pela inscrição as modalidades não tem o que mostrar no bloco delas. */
  private readonly semDerivacao = computed(() => this.avaliacao()?.modalidades?.derivada === false);
  protected readonly indice = computed(() => {
    const { chave, indice } = this.escolhida();
    const passos = this.passos();
    const achado = chave === null ? -1 : passos.findIndex((p) => p.chave === chave);
    return achado >= 0 ? achado : Math.max(0, Math.min(indice, passos.length - 1));
  });
  protected readonly passoAtual = computed(() => this.passos()[this.indice()] ?? null);

  /** A avaliação com modalidades derivadas: só ela tem resumo na Revisão. */
  protected readonly avaliacaoDerivada = computed(() => {
    const avaliacao = this.avaliacao();
    return avaliacao?.modalidades?.derivada ? avaliacao : null;
  });
  protected readonly secoesQueDefinem = computed(() =>
    secoesQueDefinemAsModalidades(this.passos(), this.formulario().dependenciasDaAvaliacao),
  );
  /**
   * O último conjunto decidido das modalidades. Enquanto falta responder, ele fica: o conjunto que vier
   * depois é comparado com o que o candidato tinha antes de abrir a pendência.
   */
  private readonly conjuntoConhecido = linkedSignal<
    ModalidadesAvaliadas | null,
    ModalidadesAvaliadas | null
  >({
    source: computed(() => this.avaliacao()?.modalidades ?? null),
    computation: (atuais, anterior) => (conhecidas(atuais) ? atuais : (anterior?.value ?? null)),
  });
  /**
   * Os documentos que a avaliação pede no próprio formulário: a árvore da escolha e o que falta
   * responder; nulos antes da primeira avaliação dos documentos.
   */
  protected readonly documentosDaAvaliacao = computed<{
    readonly arvore: readonly NoDeDocumentos[];
    readonly pendencias: readonly PendenciaDaAvaliacao[];
  } | null>(
    () => {
      const avaliados = this.avaliacao()?.documentos ?? null;
      if (avaliados === null) return null;
      const formulario = this.formulario();
      const { documentos, pendencias } = documentosDoFormulario(
        avaliados,
        formulario.faseId,
        formulario.finalidade,
      );
      return {
        arvore: arvoreDeDocumentos(documentos, formulario.grupos, this.grupos()),
        pendencias,
      };
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  /**
   * A mesma resposta pode mudar as modalidades e os documentos: os dois vão no mesmo anúncio, e só o que
   * mudou desta vez entra nele — o anúncio de antes não volta a ser lido.
   */
  protected readonly anuncioDaAvaliacao = linkedSignal<
    {
      readonly modalidades: ModalidadesAvaliadas | null;
      readonly documentos: readonly NoDeDocumentos[] | null;
      readonly integrantes: ReadonlySet<string>;
    },
    string
  >({
    source: computed(() => ({
      modalidades: this.conjuntoConhecido(),
      documentos: this.documentosDaAvaliacao()?.arvore ?? null,
      integrantes: new Set(Object.values(this.grupos()).flatMap((lista) => lista.map((o) => o.id))),
    })),
    computation: (atual, anterior) => {
      if (!anterior) return '';
      const antes = anterior.source;
      return [
        atual.modalidades === antes.modalidades
          ? ''
          : anunciarMudancaDasModalidades(antes.modalidades, atual.modalidades),
        atual.documentos === antes.documentos
          ? ''
          : anunciarMudancaDosDocumentos(antes.documentos, atual.documentos, atual.integrantes),
      ]
        .filter((parte) => parte)
        .join(' ');
    },
  });

  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Os campos que aparecem no passo atual, para anunciar o que aparece e o que some. */
  private readonly camposVisiveis = computed<CamposDoPasso>(() => {
    const passo = this.passoAtual();
    return {
      chave: passo?.chave ?? null,
      campos: new Map((passo?.campos ?? []).map((c) => [c.campo.fatoCodigo, c.campo.rotulo])),
    };
  });
  protected readonly anuncio = linkedSignal<CamposDoPasso, string>({
    source: this.camposVisiveis,
    computation: (atuais, anterior) => (anterior ? anunciar(anterior.source, atuais) : ''),
  });

  protected readonly mensagemDosErros = mensagemDosErros;

  constructor() {
    effect(() => {
      const simulacao = this.simulacao();
      untracked(() => this.simulacaoChange.emit(simulacao));
    });
    effect(() => {
      const aceitos = this.termosAceitos();
      untracked(() => this.termosAceitosChange.emit(aceitos));
    });
    effect(() => {
      const [primeiro] = this.errosDoServidor();
      if (primeiro) untracked(() => this.irAoCampo(primeiro.campo));
    });
  }

  protected errosEm(codigo: string): readonly ErroDoServidor[] {
    return this.erros().filter((e) => erroEm(e, codigo));
  }

  protected comErro(passo: PassoDoFormulario): boolean {
    return this.erros().some((e) => contemOCampo(passo, e.campo));
  }

  /** O que dizer ao lado do termo: a recusa do servidor ou, com a seção concluída, a falta do aceite. */
  protected problemaDoTermo(passo: PassoDoFormulario, termo: TermoNoPasso): string | null {
    return (
      mensagemDosErros(this.erros(), termo.termo.codigo) ??
      (this.termoPendente(passo, termo) ? 'Aceite o termo para concluir.' : null)
    );
  }

  /**
   * Vai à seção do campo, grupo ou termo e põe o foco no primeiro controle dele — o recusado pelo
   * servidor ou a pergunta que falta para calcular as modalidades.
   */
  protected irAoCampo(campo: string): void {
    const indice = this.passos().findIndex((passo) => contemOCampo(passo, campo));
    if (indice < 0) return;
    this.irPara(indice, () => this.controleDe(campo));
  }

  protected irASecao(chave: string): void {
    const indice = this.passos().findIndex((passo) => passo.chave === chave);
    if (indice >= 0) this.irPara(indice);
  }

  /** O primeiro controle do campo, grupo ou termo; o campo de uma ocorrência cai no grupo dela. */
  private controleDe(campo: string): HTMLElement | null {
    const partes = Array.from(
      this.elemento.nativeElement.querySelectorAll<HTMLElement>('[data-campo]'),
    );
    const alvo =
      partes.find((p) => p.dataset['campo'] === campo) ??
      partes.find((p) => p.dataset['campo'] === campo.split('.')[0]);
    return alvo?.querySelector<HTMLElement>('input, select, textarea, button') ?? null;
  }

  /**
   * Dá todas as seções como concluídas, como o envio faz, e devolve quantas pendências ficam. Concluir
   * pode mostrar outra seção — o opcional em branco passa a não informado —, e ela também é concluída.
   * Com pendência, leva à seção da primeira, põe o foco nela e anuncia quantas são.
   */
  concluirTodas(): number {
    let mudou = false;
    while (this.concluir(this.passos())) mudou = true;

    const pendentes = this.passos().map((passo) => pendenciasDo(passo, this.aceitos()));
    const total = pendentes.reduce((soma, codigos) => soma + codigos.length, 0);
    const indice = pendentes.findIndex((codigos) => codigos.length > 0);
    if (indice < 0) return 0;

    const [primeira] = pendentes[indice];
    // O que concluir revelou só existe na tela depois da renderização, mesmo na seção atual.
    this.irPara(indice, () => this.controleDe(primeira), mudou);
    // A troca de seção recalcula o anúncio dos campos; o da pendência é escrito depois dela.
    this.anuncio();
    this.anuncio.set(
      `${total === 1 ? 'Há 1 item a corrigir' : `Há ${total} itens a corrigir`}. ` +
        `O primeiro está na seção ${this.passos()[indice].titulo}.`,
    );
    return total;
  }

  protected concluido(passo: PassoDoFormulario): boolean {
    return passo.etapasNasRegras.length > 0
      ? passo.etapasNasRegras.every((e) => this.concluidas().has(e))
      : this.blocosConcluidos().has(passo.chave);
  }

  /** O termo obrigatório ainda não aceito, depois de a seção ser dada como concluída. */
  protected termoPendente(passo: PassoDoFormulario, termo: TermoNoPasso): boolean {
    return this.concluido(passo) && termoSemAceite(termo, this.aceitos());
  }

  protected alternarAceite(codigo: string, evento: Event): void {
    const aceito = (evento.target as HTMLInputElement).checked;
    this.descartarErros(codigo);
    this.aceitos.update((atual) => {
      const novos = new Set(atual);
      if (aceito) novos.add(codigo);
      else novos.delete(codigo);
      return novos;
    });
  }

  protected respostaDaUf(campo: CampoNoPasso): ValorJson | undefined {
    const fato = fatoDaUf(campo.regra);
    return fato === null ? undefined : this.respostasComAsFixas()[fato];
  }

  protected responder(fato: string, valor: ValorJson | undefined): void {
    this.descartarErros(fato);
    this.respostas.update((atual) => {
      const novas = { ...atual };
      if (valor === undefined) delete novas[fato];
      else novas[fato] = valor;
      return novas;
    });
  }

  protected responderGrupo(
    codigo: string,
    ocorrencias: readonly OcorrenciaSimulada[] | undefined,
  ): void {
    this.descartarErros(codigo);
    this.grupos.update((atual) => {
      const novos = { ...atual };
      if (ocorrencias === undefined) delete novos[codigo];
      else novos[codigo] = ocorrencias;
      return novos;
    });
  }

  /** Dá a seção atual como concluída e segue para a próxima; na última, só conclui. */
  protected avancar(): void {
    const passo = this.passoAtual();
    if (passo) this.concluir([passo]);
    if (this.indice() < this.passos().length - 1) this.irPara(this.indice() + 1);
  }

  /**
   * Dá os passos como concluídos — as etapas das regras e, no bloco do sistema, a chave — e diz se algo
   * mudou. O passo já concluído não muda a simulação: o conjunto só é trocado quando ganha algo novo.
   */
  private concluir(passos: readonly PassoDoFormulario[]): boolean {
    const etapasNovas = passos
      .flatMap((p) => p.etapasNasRegras)
      .filter((e) => !this.concluidas().has(e));
    const blocosNovos = passos
      .filter((p) => p.etapasNasRegras.length === 0 && !this.blocosConcluidos().has(p.chave))
      .map((p) => p.chave);
    if (etapasNovas.length > 0)
      this.concluidas.update((atual) => new Set([...atual, ...etapasNovas]));
    if (blocosNovos.length > 0)
      this.blocosConcluidos.update((atual) => new Set([...atual, ...blocosNovos]));
    return etapasNovas.length > 0 || blocosNovos.length > 0;
  }

  /**
   * Troca de seção e leva o foco ao título dela, para quem navega por teclado ou leitor de tela, ou ao
   * elemento que `foco` indicar depois de a seção aparecer. Na seção em que o candidato já está não há o
   * que esperar: o foco vai na hora, sem ficar pendente para uma renderização qualquer depois — salvo
   * quando `depoisDeRenderizar` diz que o alvo ainda vai aparecer.
   */
  protected irPara(
    indice: number,
    foco?: () => HTMLElement | null,
    depoisDeRenderizar = false,
  ): void {
    const destino = Math.max(0, Math.min(indice, this.passos().length - 1));
    const focar = (): void => (foco?.() ?? this.titulo()?.nativeElement)?.focus();
    const mesmaSecao = destino === this.indice();
    this.escolhida.set({ chave: this.passos()[destino]?.chave ?? null, indice: destino });
    if (mesmaSecao && !depoisDeRenderizar) focar();
    else afterNextRender(focar, { injector: this.injector });
  }

  private descartarErros(codigo: string): void {
    if (this.erros().some((e) => erroEm(e, codigo)))
      this.erros.update((atuais) => atuais.filter((e) => !erroEm(e, codigo)));
  }
}

/** O campo — o código de um campo, grupo ou termo, ou de dentro de um grupo — é deste passo. */
function contemOCampo(passo: PassoDoFormulario, campo: string): boolean {
  return (
    passo.campos.some((c) => campo === c.campo.fatoCodigo) ||
    passo.grupos.some((g) => campoEm(campo, g.grupo.codigo)) ||
    passo.termos.some((t) => campo === t.termo.codigo)
  );
}

interface CamposDoPasso {
  readonly chave: string | null;
  readonly campos: ReadonlyMap<string, string>;
}

/** "Apareceu: X. Saiu: Y." quando os campos do mesmo passo mudam com uma resposta; nada ao trocar de passo. */
function anunciar(anteriores: CamposDoPasso, atuais: CamposDoPasso): string {
  if (anteriores.chave !== atuais.chave) return '';
  const apareceram = [...atuais.campos.entries()]
    .filter(([codigo]) => !anteriores.campos.has(codigo))
    .map(([, rotulo]) => rotulo);
  const sairam = [...anteriores.campos.entries()]
    .filter(([codigo]) => !atuais.campos.has(codigo))
    .map(([, rotulo]) => rotulo);
  return [
    apareceram.length > 0 ? `Apareceu: ${apareceram.join(', ')}.` : '',
    sairam.length > 0 ? `Saiu: ${sairam.join(', ')}.` : '',
  ]
    .filter((parte) => parte !== '')
    .join(' ');
}
