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
import { CampoDoCandidatoComponent } from './campo-do-candidato';
import {
  BLOCO_COMPROVACAO_DOCUMENTAL,
  BLOCO_MODALIDADES_CALCULADAS,
  BLOCO_REVISAO_E_ACEITE,
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
} from './formulario-do-candidato.model';
import { GrupoDoCandidatoComponent } from './grupo-do-candidato';
import { interpretarFormulario } from './interpretador/interpretador';
import type {
  OcorrenciaSimulada,
  SimulacaoDoFormulario,
  ValorJson,
} from './interpretador/regras-do-formulario';

/** Um documento que o bloco de comprovação documental lista. */
export interface DocumentoDoFormulario {
  readonly nome: string;
  readonly descricao?: string | null;
}

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
  imports: [AlertComponent, CampoDoCandidatoComponent, GrupoDoCandidatoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="formulario-candidato">
      <p class="sr-only" aria-live="polite">{{ anuncio() }}</p>

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
                  <p>
                    As modalidades em que o candidato concorre são calculadas pelo sistema a partir
                    das respostas dadas.
                  </p>
                }
                @case (BLOCO_COMPROVACAO_DOCUMENTAL) {
                  @if (documentos(); as lista) {
                    @if (lista.length === 0) {
                      <p>Nenhum documento é exigido nesta fase.</p>
                    } @else {
                      <ul class="formulario-candidato__documentos">
                        @for (documento of lista; track documento.nome) {
                          <li>
                            <strong>{{ documento.nome }}</strong>
                            @if (documento.descricao) {
                              — {{ documento.descricao }}
                            }
                          </li>
                        }
                      </ul>
                    }
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
                  (ocorrenciasChange)="responderGrupo(grupo.grupo.codigo, $event)"
                />
              }

              @if (passo.bloco === BLOCO_REVISAO_E_ACEITE) {
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
              <button type="button" class="btn btn--primary" (click)="avancar()">
                {{ indice() === passos().length - 1 ? 'Concluir a seção' : 'Próxima seção' }}
              </button>
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
  /** A lista do bloco de comprovação documental; nula quando quem hospeda não a tem. */
  readonly documentos = input<readonly DocumentoDoFormulario[] | null>(null);
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

  /** A simulação a cada mudança: as respostas, as ocorrências, as seções concluídas e os pressupostos. */
  readonly simulacaoChange = output<SimulacaoDoFormulario>();
  /** Os termos aceitos, pelo código, a cada mudança. */
  readonly termosAceitosChange = output<readonly string[]>();

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
  }));

  private readonly interpretacao = computed(() =>
    interpretarFormulario(this.formulario().regras, this.simulacao()),
  );
  protected readonly recusa = computed(() => {
    const interpretacao = this.interpretacao();
    return interpretacao.valida ? null : interpretacao.erro;
  });
  protected readonly passos = computed<readonly PassoDoFormulario[]>(() => {
    const interpretacao = this.interpretacao();
    return interpretacao.valida ? passosDo(this.formulario(), interpretacao.avaliacao) : [];
  });
  protected readonly indice = computed(() => {
    const { chave, indice } = this.escolhida();
    const passos = this.passos();
    const achado = chave === null ? -1 : passos.findIndex((p) => p.chave === chave);
    return achado >= 0 ? achado : Math.max(0, Math.min(indice, passos.length - 1));
  });
  protected readonly passoAtual = computed(() => this.passos()[this.indice()] ?? null);

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
      if (primeiro) untracked(() => this.irAoErro(primeiro));
    });
  }

  protected errosEm(codigo: string): readonly ErroDoServidor[] {
    return this.erros().filter((e) => erroEm(e, codigo));
  }

  protected comErro(passo: PassoDoFormulario): boolean {
    return this.erros().some((e) => contemOCampo(passo, e));
  }

  /** O que dizer ao lado do termo: a recusa do servidor ou, com a seção concluída, a falta do aceite. */
  protected problemaDoTermo(passo: PassoDoFormulario, termo: TermoNoPasso): string | null {
    return (
      mensagemDosErros(this.erros(), termo.termo.codigo) ??
      (this.termoPendente(passo, termo) ? 'Aceite o termo para concluir.' : null)
    );
  }

  /** Vai à seção do erro e põe o foco no primeiro controle do que foi recusado. */
  private irAoErro(erro: ErroDoServidor): void {
    const indice = this.passos().findIndex((passo) => contemOCampo(passo, erro));
    if (indice < 0) return;
    this.irPara(indice, () => {
      const partes = Array.from(
        this.elemento.nativeElement.querySelectorAll<HTMLElement>('[data-campo]'),
      );
      const alvo =
        partes.find((p) => p.dataset['campo'] === erro.campo) ??
        partes.find((p) => p.dataset['campo'] === erro.campo.split('.')[0]);
      return alvo?.querySelector<HTMLElement>('input, select, textarea, button') ?? null;
    });
  }

  protected concluido(passo: PassoDoFormulario): boolean {
    return passo.etapasNasRegras.length > 0
      ? passo.etapasNasRegras.every((e) => this.concluidas().has(e))
      : this.blocosConcluidos().has(passo.chave);
  }

  /** O termo obrigatório ainda não aceito, depois de a seção ser dada como concluída. */
  protected termoPendente(passo: PassoDoFormulario, termo: TermoNoPasso): boolean {
    return (
      this.concluido(passo) &&
      termo.avaliado.obrigatorio === 'VERDADEIRO' &&
      !this.aceitos().has(termo.termo.codigo)
    );
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
    if (passo) {
      // A seção já concluída não muda a simulação: o conjunto só é trocado quando ganha etapa nova.
      if (passo.etapasNasRegras.some((e) => !this.concluidas().has(e))) {
        this.concluidas.update((atual) => new Set([...atual, ...passo.etapasNasRegras]));
      }
      if (passo.etapasNasRegras.length === 0 && !this.blocosConcluidos().has(passo.chave)) {
        this.blocosConcluidos.update((atual) => new Set([...atual, passo.chave]));
      }
    }
    if (this.indice() < this.passos().length - 1) this.irPara(this.indice() + 1);
  }

  /**
   * Troca de seção e leva o foco ao título dela, para quem navega por teclado ou leitor de tela, ou ao
   * elemento que `foco` indicar depois de a seção aparecer. Na seção em que o candidato já está não há o
   * que esperar: o foco vai na hora, sem ficar pendente para uma renderização qualquer depois.
   */
  protected irPara(indice: number, foco?: () => HTMLElement | null): void {
    const destino = Math.max(0, Math.min(indice, this.passos().length - 1));
    const focar = (): void => (foco?.() ?? this.titulo()?.nativeElement)?.focus();
    const mesmaSecao = destino === this.indice();
    this.escolhida.set({ chave: this.passos()[destino]?.chave ?? null, indice: destino });
    if (mesmaSecao) focar();
    else afterNextRender(focar, { injector: this.injector });
  }

  private descartarErros(codigo: string): void {
    if (this.erros().some((e) => erroEm(e, codigo)))
      this.erros.update((atuais) => atuais.filter((e) => !erroEm(e, codigo)));
  }
}

/** O erro é de um campo, grupo ou termo deste passo. */
function contemOCampo(passo: PassoDoFormulario, erro: ErroDoServidor): boolean {
  return (
    passo.campos.some((c) => erro.campo === c.campo.fatoCodigo) ||
    passo.grupos.some((g) => erroEm(erro, g.grupo.codigo)) ||
    passo.termos.some((t) => erro.campo === t.termo.codigo)
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
