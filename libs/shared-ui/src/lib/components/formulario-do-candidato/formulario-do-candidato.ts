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
import { type StepItem, StepsComponent } from '../steps/steps.component';
import { StepsResponsivoComponent } from '../steps-responsivo/steps-responsivo.component';
import {
  type DocumentoExigido,
  ListaDeDocumentosComponent,
} from '../lista-de-documentos/lista-de-documentos';
import { CampoDoCandidatoComponent } from './campo-do-candidato';
import { avaliarConfirmacoes } from './confirmacao-do-campo';
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
  type PassoPrefixado,
  type PendenciaDoPasso,
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
  situacoesEArquivosDosDocumentos,
  type NoDeDocumentos,
} from './documentos-avaliados';
import { DocumentosDaInscricaoComponent } from './documentos-da-inscricao';
import type { EnvioDeDocumentos } from './envio-de-documentos';
import { FatorDeAtenuacaoDaInscricaoComponent } from './fator-de-atenuacao-da-inscricao';
import { resumoDoFator } from './fator-de-atenuacao';
import { NomesDeMunicipios } from '../editor-de-condicoes/valor-de-municipio';
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
import { estaVazia } from './interpretador/logica';
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
    FatorDeAtenuacaoDaInscricaoComponent,
    StepsComponent,
    StepsResponsivoComponent,
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
      } @else if (passos().length === 0 && passosPrefixados().length === 0) {
        <ui-alert variant="info" [dynamic]="false">O formulário não tem seção a mostrar.</ui-alert>
      } @else {
        <div
          class="formulario-candidato__layout"
          [class.formulario-candidato__layout--lateral]="lateral()"
        >
          @if (lateral()) {
            <ui-steps-responsivo
              [rotuloDaNavegacao]="rotuloDaNavegacao()"
              [nomeDaLista]="nomeDaLista()"
              [titulo]="tituloDoPassoAtual()"
              [meta]="posicao()"
              [progresso]="progresso()"
              [items]="itensDosPassos()"
              (selecionado)="irParaSePermitido($event)"
            />
          } @else {
            <ui-steps
              variante="chips"
              [rotuloDaNavegacao]="rotuloDaNavegacao()"
              [items]="itensDosPassos()"
              (selecionado)="irParaSePermitido($event)"
            />
          }
          <div class="formulario-candidato__corpo">
            <!-- Cada partida nova — outro formulário, outra simulação inicial — recria os campos: o que
             se digitou pela metade e a confirmação não passam de uma partida para outra. -->
            @for (partidaAtual of [partida()]; track partidaAtual) {
              @if (passoAtual() ?? prefixadoAtual(); as atual) {
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
                    {{ atual.titulo }}
                    <span class="sr-only">, {{ posicao().toLowerCase() }}</span>
                  </h3>
                  @if (atual.descricao) {
                    <p class="formulario-candidato__descricao">{{ atual.descricao }}</p>
                  }
                  @if (passoAtual(); as passo) {
                    @if (passo.aviso) {
                      <ui-alert variant="warning" [dynamic]="false">{{ passo.aviso }}</ui-alert>
                    }
                    @if (recusasDaSecao(passo); as recusadas) {
                      <ui-alert
                        variant="danger"
                        [dynamic]="false"
                        [heading]="tituloDasRecusas(recusadas)"
                      >
                        Corrija o que está marcado nesta seção e tente de novo.
                      </ui-alert>
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
                            [envioDeDocumentos]="envioDeDocumentos()"
                            [arquivosEnviados]="arquivosDosDocumentos()"
                            [situacoes]="situacoesDosDocumentos()"
                            [podeEnviar]="podeEnviarDocumentos()"
                            [podeRemover]="podeRemoverDocumentos()"
                            [ocorrenciasGravadas]="ocorrenciasGravadas()"
                            (irAoCampo)="irAoCampo($event)"
                            (tentarDeNovo)="tentarAvaliarDeNovo.emit()"
                          />
                        } @else if (documentos(); as lista) {
                          <ui-lista-de-documentos
                            [documentos]="lista"
                            [semDocumentos]="semDocumentos()"
                          />
                        } @else {
                          <p>
                            Os documentos exigidos são listados a partir da publicação do processo.
                          </p>
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
                        [confirmacao]="confirmacoes()[campo.campo.fatoCodigo] ?? ''"
                        [problemaDaConfirmacao]="
                          problemasDaConfirmacao().get(campo.campo.fatoCodigo) ?? null
                        "
                        (respondida)="responder(campo.campo.fatoCodigo, $event)"
                        (confirmada)="confirmar(campo.campo.fatoCodigo, $event)"
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
                        [confirmacoes]="confirmacoes()"
                        [problemasDaConfirmacao]="problemasDaConfirmacao()"
                        (ocorrenciasChange)="responderGrupo(grupo.grupo.codigo, $event)"
                        (confirmada)="confirmar($event.campo, $event.texto)"
                      />
                    }

                    @if (passo.bloco === BLOCO_REVISAO_E_ACEITE) {
                      @for (item of resumosDosPrefixados(); track item.chave) {
                        <article
                          class="formulario-candidato__resumo"
                          [attr.aria-labelledby]="idBase() + '-resumo-' + item.chave"
                        >
                          <h4 [id]="idBase() + '-resumo-' + item.chave">{{ item.titulo }}</h4>
                          <dl>
                            @for (linha of item.resumo; track $index) {
                              <dt>{{ linha.rotulo }}</dt>
                              <dd>{{ linha.valor }}</dd>
                            }
                          </dl>
                          <button
                            type="button"
                            class="btn btn--secondary btn--sm"
                            (click)="irAoPasso(item.chave)"
                          >
                            Alterar<span class="sr-only"> {{ item.titulo }}</span>
                          </button>
                        </article>
                      }
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
                      @if (fatorNaRevisao(); as resumo) {
                        <ui-fator-de-atenuacao-da-inscricao
                          [resumo]="resumo"
                          [idBase]="idBase() + '-fator'"
                          (irASecao)="irASecao($event)"
                        />
                      }
                      @for (termo of passo.termos; track termo.termo.codigo) {
                        <article
                          class="formulario-candidato__termo"
                          [attr.data-campo]="termo.termo.codigo"
                          [attr.aria-labelledby]="idBase() + '-termo-' + termo.termo.codigo"
                        >
                          <h4 [id]="idBase() + '-termo-' + termo.termo.codigo">
                            {{ termo.termo.nome }}
                          </h4>
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
                  } @else {
                    <ng-content />
                  }
                </section>

                <div class="formulario-candidato__acoes">
                  <button
                    type="button"
                    class="btn btn--secondary"
                    [disabled]="indice() === 0"
                    (click)="irPara(indice() - 1)"
                  >
                    {{ rotuloDoAnterior() }}
                  </button>
                  @if (indice() < total() - 1) {
                    <button type="button" class="btn btn--primary" (click)="avancar()">
                      {{ rotuloDoProximo() }}
                    </button>
                  } @else if (concluirNaUltimaSecao()) {
                    <button type="button" class="btn btn--primary" (click)="avancar()">
                      Concluir a seção
                    </button>
                  }
                </div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class FormularioDoCandidatoComponent {
  private readonly injector = inject(Injector);
  private readonly municipios = inject(NomesDeMunicipios);

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
  /**
   * Como o candidato envia os arquivos dos documentos exigidos; nulo, o bloco só lista, como na
   * simulação do administrador.
   */
  readonly envioDeDocumentos = input<EnvioDeDocumentos | null>(null);
  /** Enviar arquivo vale enquanto a inscrição não está sendo enviada, inclusive na correção. */
  readonly podeEnviarDocumentos = input(true);
  /** Remover arquivo só vale enquanto a inscrição é rascunho. */
  readonly podeRemoverDocumentos = input(true);
  /** As ocorrências de grupo que a inscrição gravada já tem; nulo, toda ocorrência vale. */
  readonly ocorrenciasGravadas = input<ReadonlySet<string> | null>(null);
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
   * A chave do passo prefixado em que quem hospeda já apontou a recusa que lhe cabe. Com ela, uma lista
   * nova de recusas não leva o candidato ao primeiro campo recusado: quem hospeda o levou ao passo.
   */
  readonly passoDaRecusa = input<string | null>(null);
  /**
   * Se a última seção tem o botão que a conclui. Quem hospeda uma ação final própria, como o envio da
   * inscrição, o desliga e chama `concluirTodas()` nela.
   */
  readonly concluirNaUltimaSecao = input(true);
  /**
   * Se avançar exige a seção atual sem pendência: com pendência, o candidato fica onde está, com o
   * foco na primeira. Voltar é sempre livre. A simulação do administrador deixa desligado.
   */
  readonly exigirSecaoValida = input(false);
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
  /**
   * Passos que o formulário não conhece e quem hospeda preenche, antes das seções, como a escolha do
   * curso. O conteúdo de cada um é projetado quando ele é o atual (`passoPrefixadoAtual()` diz qual);
   * a conclusão, o erro e o resumo da Revisão vêm de quem hospeda.
   */
  readonly passosPrefixados = input<readonly PassoPrefixado[]>([]);
  /**
   * Como os passos se apresentam: `chips`, em linha, ou `lateral`, a coluna do assistente — que em
   * tela estreita vira a barra da seção atual e o diálogo com a lista.
   */
  readonly apresentacaoDosPassos = input<'chips' | 'lateral'>('chips');

  /** A simulação a cada mudança: as respostas, as ocorrências, as seções concluídas e os pressupostos. */
  readonly simulacaoChange = output<SimulacaoDoFormulario>();
  /** O avanço que o passo prefixado, ainda não concluído, barrou: quem hospeda o leva ao que falta. */
  readonly avancoBarrado = output<string>();
  /** As pendências por seção a cada mudança, para quem hospeda dizer por que o envio ainda não segue. */
  readonly pendenciasChange = output<readonly PendenciaDaSecao[]>();
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
  /**
   * A confirmação digitada de cada campo que a pede, pelo código da tela: o fato ou `grupo.ocorrência.fato`.
   * Mora aqui, e não no campo, porque o envio confere também as seções que não estão na tela e porque a
   * seção trocada recria o campo, que perderia o que se digitou.
   */
  protected readonly confirmacoes = linkedSignal<unknown, Readonly<Record<string, string>>>({
    source: this.partida,
    computation: () => ({}),
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

  /**
   * As respostas fixas que a conta não tem: o candidato não pode dá-las, então o formulário não as
   * cobra — a recusa é do servidor, que a aponta no campo.
   */
  private readonly fixasSemResposta = computed<ReadonlySet<string>>(
    () =>
      new Set(
        Object.entries(this.respostasFixas())
          .filter(([, fixa]) => fixa && estaVazia(fixa.valor))
          .map(([fato]) => fato),
      ),
  );

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

  /** As confirmações que faltam ou não conferem, pelo código da tela. */
  protected readonly problemasDaConfirmacao = computed(() =>
    avaliarConfirmacoes(this.passos(), {
      respostas: this.respostasComAsFixas(),
      grupos: this.grupos(),
      confirmacoes: this.confirmacoes(),
      fixas: this.respostasFixas(),
    }),
  );

  private readonly interpretacao = computed(() =>
    interpretarFormulario(
      this.formulario().regras,
      this.simulacao(),
      new Set(Object.keys(this.respostasFixas())),
    ),
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
  private itemDoPasso(
    chave: string,
    rotulo: string,
    concluido: boolean,
    comErro: boolean,
  ): StepItem {
    const status = chave === this.chaveAtual() ? 'active' : concluido ? 'done' : 'unvisited';
    return { chave, rotulo, status, concluido, comErro };
  }
  /** Os botões chamam de passo o que não é seção do formulário e de seção o que é. */
  protected readonly rotuloDoAnterior = computed(() => {
    const prefixados = this.passosPrefixados().length;
    return prefixados > 0 && this.indice() <= prefixados ? 'Passo anterior' : 'Seção anterior';
  });
  protected readonly rotuloDoProximo = computed(() =>
    this.passoAtual() ? 'Próxima seção' : 'Próximo passo',
  );
  protected readonly lateral = computed(() => this.apresentacaoDosPassos() === 'lateral');
  /** As chaves de todos os passos na ordem em que aparecem: os prefixados e, depois, as seções. */
  private readonly chaves = computed(() =>
    [...this.passosPrefixados(), ...this.passos()].map((p) => p.chave),
  );
  protected readonly total = computed(() => this.chaves().length);
  /** O índice entre todos os passos — os prefixados primeiro, depois as seções. */
  protected readonly indice = computed(() => {
    const { chave, indice } = this.escolhida();
    const achado = chave === null ? -1 : this.chaves().indexOf(chave);
    return achado >= 0 ? achado : Math.max(0, Math.min(indice, this.total() - 1));
  });
  /** A chave do passo em que o candidato está. */
  private readonly chaveAtual = computed(() => this.chaves()[this.indice()] ?? null);
  protected readonly itensDosPassos = computed<StepItem[]>(() => {
    const chavesComPendencia = new Set(this.pendenciasCompletas().map((s) => s.passo.chave));
    return [
      ...this.passosPrefixados().map((passo) =>
        this.itemDoPasso(
          passo.chave,
          passo.titulo,
          passo.concluido === true,
          passo.comErro === true,
        ),
      ),
      ...this.passos().map((passo) => {
        // A seção dada como concluída com pendência não passa por pronta: aparece com o estado de erro.
        const pendente = this.concluido(passo) && chavesComPendencia.has(passo.chave);
        return this.itemDoPasso(
          passo.chave,
          passo.titulo,
          this.concluido(passo) && !pendente,
          this.comErro(passo) || pendente,
        );
      }),
    ];
  });
  protected readonly passoAtual = computed(
    () => this.passos().find((p) => p.chave === this.chaveAtual()) ?? null,
  );
  protected readonly prefixadoAtual = computed(
    () => this.passosPrefixados().find((p) => p.chave === this.chaveAtual()) ?? null,
  );
  /** Quantos passos já estão concluídos, entre todos, para a barra de progresso. */
  protected readonly progresso = computed(
    () =>
      (this.itensDosPassos().filter((item) => item.concluido === true).length / this.total()) * 100,
  );
  /** Onde o candidato está, para o leitor de tela e para a barra: a posição entre todos os passos. */
  protected readonly posicao = computed(
    () => `${this.temPrefixados() ? 'Passo' : 'Seção'} ${this.indice() + 1} de ${this.total()}`,
  );
  private readonly temPrefixados = computed(() => this.passosPrefixados().length > 0);
  /** Com passos de quem hospeda a lista reúne passos, não só seções do formulário. */
  protected readonly rotuloDaNavegacao = computed(() =>
    this.temPrefixados() ? 'Passos da inscrição' : 'Seções do formulário',
  );
  protected readonly nomeDaLista = computed(() => (this.temPrefixados() ? 'passos' : 'seções'));
  /** A chave do passo prefixado em que o candidato está, ou `null` numa seção do formulário. */
  readonly passoPrefixadoAtual = computed(() => this.prefixadoAtual()?.chave ?? null);
  protected readonly tituloDoPassoAtual = computed(
    () => this.prefixadoAtual()?.titulo ?? this.passoAtual()?.titulo ?? '',
  );
  /** Os passos prefixados que mostram algo na Revisão. */
  protected readonly resumosDosPrefixados = computed(() =>
    this.passosPrefixados().filter((p) => (p.resumo?.length ?? 0) > 0),
  );

  /** A avaliação com modalidades derivadas: só ela tem resumo na Revisão. */
  protected readonly avaliacaoDerivada = computed(() => {
    const avaliacao = this.avaliacao();
    return avaliacao?.modalidades?.derivada ? avaliacao : null;
  });
  protected readonly fatorNaRevisao = computed(() =>
    resumoDoFator(
      this.passos(),
      this.respostasComAsFixas(),
      this.municipios,
      this.formulario().dependenciasDoFator,
      this.grupos(),
      this.respostasFixas(),
    ),
  );
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
  /** O último conjunto decidido das modalidades da 2ª opção de curso, mantido como o da 1ª. */
  private readonly conjuntoConhecidoDaSegundaOpcao = linkedSignal<
    ModalidadesAvaliadas | null,
    ModalidadesAvaliadas | null
  >({
    source: computed(() => this.avaliacao()?.modalidadesSegundaOpcao ?? null),
    // Sem 2ª opção, não há conjunto a guardar: o da opção retirada não volta.
    computation: (atuais, anterior) =>
      atuais === null ? null : conhecidas(atuais) ? atuais : (anterior?.value ?? null),
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
  /** A situação e os arquivos de cada exigência da fase, como a avaliação da API os traz. */
  private readonly situacaoEArquivos = computed(
    () => {
      const formulario = this.formulario();
      const avaliados = this.avaliacao()?.documentos ?? null;
      return situacoesEArquivosDosDocumentos(
        avaliados === null
          ? []
          : documentosDoFormulario(avaliados, formulario.faseId, formulario.finalidade).documentos,
      );
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  protected readonly situacoesDosDocumentos = computed(() => this.situacaoEArquivos().situacoes);
  protected readonly arquivosDosDocumentos = computed(() => this.situacaoEArquivos().arquivos);
  /**
   * A mesma resposta pode mudar as modalidades e os documentos: os dois vão no mesmo anúncio, e só o que
   * mudou desta vez entra nele — o anúncio de antes não volta a ser lido.
   */
  protected readonly anuncioDaAvaliacao = linkedSignal<
    {
      readonly modalidades: ModalidadesAvaliadas | null;
      readonly modalidadesDaSegundaOpcao: ModalidadesAvaliadas | null;
      readonly documentos: readonly NoDeDocumentos[] | null;
      readonly integrantes: ReadonlySet<string>;
    },
    string
  >({
    source: computed(() => ({
      modalidades: this.conjuntoConhecido(),
      modalidadesDaSegundaOpcao: this.conjuntoConhecidoDaSegundaOpcao(),
      documentos: this.documentosDaAvaliacao()?.arvore ?? null,
      integrantes: new Set(Object.values(this.grupos()).flatMap((lista) => lista.map((o) => o.id))),
    })),
    computation: (atual, anterior) => {
      if (!anterior) return '';
      const antes = anterior.source;
      return [
        atual.modalidades === antes.modalidades
          ? ''
          : naOpcao(
              atual.modalidadesDaSegundaOpcao === null ? null : '1ª opção',
              anunciarMudancaDasModalidades(antes.modalidades, atual.modalidades),
            ),
        atual.modalidadesDaSegundaOpcao === antes.modalidadesDaSegundaOpcao
          ? ''
          : naOpcao(
              '2ª opção',
              anunciarMudancaDasModalidades(
                antes.modalidadesDaSegundaOpcao,
                atual.modalidadesDaSegundaOpcao,
              ),
            ),
        atual.documentos === antes.documentos
          ? ''
          : anunciarMudancaDosDocumentos(antes.documentos, atual.documentos, atual.integrantes),
      ]
        .filter((parte) => parte)
        .join(' ');
    },
  });

  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');
  private ultimaListaDeErros: readonly ErroDoServidor[] = [];
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
      const pendencias = this.pendenciasPorSecao();
      untracked(() => this.pendenciasChange.emit(pendencias));
    });
    effect(() => {
      const simulacao = this.simulacao();
      untracked(() => this.simulacaoChange.emit(simulacao));
    });
    effect(() => {
      const aceitos = this.termosAceitos();
      untracked(() => this.termosAceitosChange.emit(aceitos));
    });
    effect(() => {
      const erros = this.errosDoServidor();
      const aposDoHost = this.passoDaRecusa() !== null;
      untracked(() => {
        // Só a lista nova leva a algum lugar: a mudança de `passoDaRecusa` sozinha não move ninguém.
        if (erros === this.ultimaListaDeErros) return;
        this.ultimaListaDeErros = erros;
        // A recusa que quem hospeda já apontou no passo dele prevalece: as demais seguem marcadas
        // nas seções, mas o candidato não é levado para longe do passo que o hospedeiro mostrou.
        const [primeiro] = erros;
        if (primeiro && !aposDoHost) this.irAoCampo(primeiro.campo);
      });
    });
  }

  protected errosEm(codigo: string): readonly ErroDoServidor[] {
    return this.erros().filter((e) => erroEm(e, codigo));
  }

  /** Quantas respostas desta seção o servidor recusou; zero não mostra o aviso do topo. */
  protected recusasDaSecao(passo: PassoDoFormulario): number {
    return this.erros().filter((e) => contemOCampo(passo, e.campo)).length;
  }

  protected tituloDasRecusas(quantidade: number): string {
    return quantidade === 1
      ? 'O servidor recusou 1 resposta desta seção'
      : `O servidor recusou ${quantidade} respostas desta seção`;
  }

  protected comErro(passo: PassoDoFormulario): boolean {
    return this.recusasDaSecao(passo) > 0;
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
    const passo = this.passos().find((p) => contemOCampo(p, campo));
    if (passo) this.irAoPasso(passo.chave, () => this.controleDe(campo, false));
  }

  protected irASecao(chave: string): void {
    if (this.passos().some((passo) => passo.chave === chave)) this.irAoPasso(chave);
  }

  /**
   * Leva a um passo pela chave — de quem hospeda ou uma seção — e põe o foco no título dele, ou no
   * elemento que `foco` indicar depois de o passo aparecer.
   */
  irAoPasso(chave: string, foco?: () => HTMLElement | null, depoisDeRenderizar = false): void {
    const indice = this.chaves().indexOf(chave);
    if (indice >= 0) this.irPara(indice, foco, depoisDeRenderizar);
  }

  /**
   * O primeiro controle do campo, grupo ou termo, ou o da confirmação do campo; o campo de uma
   * ocorrência cai no grupo dela.
   */
  private controleDe(campo: string, naConfirmacao: boolean): HTMLElement | null {
    const partes = Array.from(
      this.elemento.nativeElement.querySelectorAll<HTMLElement>('[data-campo]'),
    );
    const alvo =
      partes.find((p) => p.dataset['campo'] === campo) ??
      partes.find((p) => p.dataset['campo'] === campo.split('.')[0]);
    return (
      alvo?.querySelector<HTMLElement>(
        naConfirmacao ? 'input[id$="-confirmacao"]' : 'input, select, textarea, button',
      ) ?? null
    );
  }

  /**
   * Dá todas as seções como concluídas, como o envio faz, quando nenhuma tem pendência, e devolve
   * quantas pendências há. Com pendência nada é concluído: com `navegar`, leva à seção da primeira, põe
   * o foco no campo e anuncia quantas são; sem ele, só conta, e quem hospeda decide para onde levar.
   */
  concluirTodas(navegar = true): number {
    const secoes = this.pendenciasCompletas();
    const total = secoes.reduce((soma, s) => soma + s.pendencias.length, 0);
    if (total === 0) {
      while (this.concluir(this.passos())) {
        // Concluir pode mostrar outra seção, que também é concluída.
      }
      return 0;
    }
    if (navegar) {
      const [primeira] = secoes;
      this.irAPendenciaDe(primeira.passo.chave);
      this.anuncio();
      this.anuncio.set(
        `${total === 1 ? 'Há 1 item a corrigir' : `Há ${total} itens a corrigir`}. ` +
          `O primeiro está na seção ${primeira.passo.titulo}.`,
      );
    }
    return total;
  }

  /**
   * Leva à seção e põe o foco no primeiro campo pendente dela. Não dá seção nenhuma como concluída,
   * salvo quando o campo só aparece depois de concluir as anteriores ou a própria seção, como o
   * obrigatório que o opcional em branco revela: então conclui, na ordem, só até ele aparecer, e a
   * seção fica com o estado de erro. Sem pendência, leva só à seção.
   */
  irAPendenciaDe(chave: string): void {
    const primeira = this.pendenciasCompletas().find((s) => s.passo.chave === chave)?.pendencias[0];
    if (!primeira) {
      this.irAoPasso(chave);
      return;
    }
    const aparece = (): boolean =>
      this.passos().some((p) => p.chave === chave && contemOCampo(p, primeira.campo));
    for (const passo of this.passos()) {
      if (aparece()) break;
      this.concluir([passo]);
    }
    // O campo revelado só existe na tela depois da renderização.
    this.irAoPasso(chave, () => this.controleDe(primeira.campo, primeira.naConfirmacao), true);
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

  protected confirmar(caminho: string, texto: string): void {
    this.confirmacoes.update((atuais) => ({ ...atuais, [caminho]: texto }));
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
    this.erros.update((atuais) => {
      const restantes = atuais.filter(
        (e) => !erroEm(e, codigo) || erroSobrevive(e, codigo, this.grupos()[codigo], ocorrencias),
      );
      return restantes.length === atuais.length ? atuais : restantes;
    });
    this.grupos.update((atual) => {
      const novos = { ...atual };
      if (ocorrencias === undefined) delete novos[codigo];
      else novos[codigo] = ocorrencias;
      return novos;
    });
  }

  /**
   * As pendências das seções, sem dar nenhuma como concluída: o que o candidato ainda tem de resolver.
   * Quem hospeda monta daqui o motivo de o envio não seguir; `concluirTodas()` é a conta que vale.
   */
  readonly pendenciasPorSecao = computed<readonly PendenciaDaSecao[]>(() =>
    this.pendenciasCompletas().map(({ passo, pendencias }) => ({
      chave: passo.chave,
      titulo: passo.titulo,
      quantidade: pendencias.length,
    })),
  );

  /** As seções com pendência, contadas como ficariam com todas concluídas, sem concluí-las. */
  private readonly pendenciasCompletas = computed(() => {
    const passos = this.passosComTodasConcluidas();
    const problemas = avaliarConfirmacoes(passos, {
      respostas: this.respostasComAsFixas(),
      grupos: this.grupos(),
      confirmacoes: this.confirmacoes(),
      fixas: this.respostasFixas(),
    });
    return passos
      .map((passo) => ({
        passo,
        pendencias: pendenciasDo(passo, this.aceitos(), problemas, this.fixasSemResposta()),
      }))
      .filter((secao) => secao.pendencias.length > 0);
  });

  /**
   * Os passos como ficariam com todas as seções concluídas, sem concluí-las: concluir pode tornar não
   * informado o opcional em branco e mostrar um obrigatório, e o motivo do envio precisa contar com ele.
   */
  private passosComTodasConcluidas(): readonly PassoDoFormulario[] {
    let etapas = new Set(this.concluidas());
    let passos = this.passos();
    for (;;) {
      const novas = passos.flatMap((p) => p.etapasNasRegras).filter((e) => !etapas.has(e));
      if (novas.length === 0) return passos;
      etapas = new Set([...etapas, ...novas]);
      const interpretacao = interpretarFormulario(
        this.formulario().regras,
        { ...this.simulacao(), etapasConcluidas: [...etapas] },
        new Set(Object.keys(this.respostasFixas())),
      );
      if (!interpretacao.valida) return passos;
      const todos = passosDo(this.formulario(), interpretacao.avaliacao);
      passos = this.semDerivacao()
        ? todos.filter((p) => p.bloco !== BLOCO_MODALIDADES_CALCULADAS)
        : todos;
    }
  }

  private pendenciasDoPasso(passo: PassoDoFormulario): PendenciaDoPasso[] {
    return pendenciasDo(
      passo,
      this.aceitos(),
      this.problemasDaConfirmacao(),
      this.fixasSemResposta(),
    );
  }

  /**
   * Chega ao passo do indicador: para trás ou para um passo já liberado vai direto; para frente, só
   * com as seções do caminho sem pendência.
   */
  protected irParaSePermitido(destino: number): void {
    const chave = this.chaves()[destino];
    if (this.pendenciaAntesDe(destino)) return;
    // Concluir uma seção pode mostrar outra: o destino é achado de novo pela chave.
    const indice = this.chaves().indexOf(chave);
    this.irPara(indice >= 0 ? indice : destino);
  }

  /**
   * Com `exigirSecaoValida`, dá as seções de agora até antes do `destino` como concluídas e, na primeira
   * com pendência, fica nela, põe o foco no primeiro campo pendente e anuncia. O passo prefixado sem
   * `concluido` também barra, e `avancoBarrado` avisa quem hospeda, que dá o foco e o motivo. Diz se
   * barrou.
   */
  private pendenciaAntesDe(destino: number): boolean {
    if (!this.exigirSecaoValida() || destino <= this.indice()) return false;
    const chaveDoDestino = this.chaves()[destino];
    // As chaves são relidas a cada passo: concluir uma seção pode mostrar outra no caminho.
    for (let i = this.indice(); ; i++) {
      const chave = this.chaves()[i];
      if (chave === undefined || chave === chaveDoDestino) break;
      // Concluir pode esconder o destino: o que ficou no lugar dele é o novo destino, e não se valida.
      // Depois da última seção não há destino, e a última é validada como as outras.
      if (chaveDoDestino !== undefined && !this.chaves().includes(chaveDoDestino)) break;
      const prefixado = this.passosPrefixados().find((p) => p.chave === chave);
      if (prefixado) {
        if (prefixado.concluido === true) continue;
        this.avancoBarrado.emit(chave);
        return true;
      }
      const secao = this.passos().find((p) => p.chave === chave);
      if (!secao) continue;
      this.concluir([secao]);
      // Relido depois de concluir: a conclusão pode revelar o que ainda falta na seção.
      const passo = this.passos().find((p) => p.chave === chave) ?? secao;
      const pendentes = this.pendenciasDoPasso(passo);
      if (pendentes.length === 0) continue;
      const [primeira] = pendentes;
      this.irAoPasso(
        passo.chave,
        () => this.controleDe(primeira.campo, primeira.naConfirmacao),
        true,
      );
      this.anuncio();
      this.anuncio.set(
        pendentes.length === 1
          ? `Há 1 item a corrigir na seção ${passo.titulo}.`
          : `Há ${pendentes.length} itens a corrigir na seção ${passo.titulo}.`,
      );
      return true;
    }
    return false;
  }

  /** Dá a seção atual como concluída e segue para a próxima; na última, só conclui. */
  protected avancar(): void {
    if (this.pendenciaAntesDe(this.indice() + 1)) return;
    const passo = this.passoAtual();
    if (passo) this.concluir([passo]);
    if (this.indice() < this.total() - 1) this.irPara(this.indice() + 1);
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
    const destino = Math.max(0, Math.min(indice, this.total() - 1));
    const focar = (): void => (foco?.() ?? this.titulo()?.nativeElement)?.focus();
    const mesmaSecao = destino === this.indice();
    this.escolhida.set({ chave: this.chaves()[destino] ?? null, indice: destino });
    if (mesmaSecao && !depoisDeRenderizar) focar();
    else afterNextRender(focar, { injector: this.injector });
  }

  private descartarErros(codigo: string): void {
    if (this.erros().some((e) => erroEm(e, codigo)))
      this.erros.update((atuais) => atuais.filter((e) => !erroEm(e, codigo)));
  }
}

/** Quantas pendências uma seção tem. */
export interface PendenciaDaSecao {
  readonly chave: string;
  readonly titulo: string;
  readonly quantidade: number;
}

/** O anúncio das modalidades de uma opção de curso, identificado quando há duas; vazio fica vazio. */
function naOpcao(opcao: string | null, anuncio: string): string {
  return opcao === null || anuncio === '' ? anuncio : `${opcao}: ${anuncio}`;
}

/**
 * A recusa de dentro de um grupo segue de pé quando a ocorrência dela continua na lista e o que ela
 * recusa não mudou: o subcampo, se a recusa é dele, ou a ocorrência toda, se a recusa é dela. A do grupo
 * em si (cardinalidade) e a de ocorrência removida, nova ou fora da lista não sobrevivem à edição.
 */
function erroSobrevive(
  erro: ErroDoServidor,
  grupo: string,
  antes: readonly OcorrenciaSimulada[] | undefined,
  depois: readonly OcorrenciaSimulada[] | undefined,
): boolean {
  if (!antes || !depois) return false;
  for (const anterior of antes) {
    const atual = depois.find((o) => o.id === anterior.id);
    if (!atual) continue;
    const ocorrencia = `${grupo}.${anterior.id}`;
    if (erro.campo === ocorrencia) return mesmoValor(anterior.respostas, atual.respostas);
    if (erro.campo.startsWith(`${ocorrencia}.`)) {
      const fato = erro.campo.slice(ocorrencia.length + 1);
      return mesmoValor(anterior.respostas?.[fato], atual.respostas?.[fato]);
    }
  }
  return false;
}

function mesmoValor(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
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
