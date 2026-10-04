import { ChangeDetectionStrategy, Component, DestroyRef, Injector, afterNextRender, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemI18nService, type ApiResult } from '@uniplus/shared-core/http';
import type { Observable } from 'rxjs';

import { AlertComponent } from '../alert/alert';
import { etapasEmOrdem, todosOsCampos, type ConteudoDoFormulario, type FatoDoFormulario } from '../editor-de-formulario/formulario-editavel';
import { SpinnerComponent } from '../spinner/spinner';
import { rotuloDoEstado } from './estado-avaliado';
import { resumoDaPreVisualizacao } from './leitura-do-resultado';
import { RespostaSimuladaComponent, type RespostaDada } from './resposta-simulada';
import {
  acrescentarOcorrencia,
  comRespostaNaOcorrencia,
  declararSemOcorrencia,
  ehDoCandidato,
  estadoDoGrupo,
  gruposDoEnvio,
  gruposSimulaveis,
  haValorNaoReconhecido,
  noLimite,
  removerOcorrencia,
  type GrupoSimulavel,
  type OcorrenciaEmSimulacao,
  type OcorrenciaSimulada,
  type SimulacaoDosGrupos,
} from './simulacao-de-grupos';
import { comResposta, simulado, type FatoSimulado } from './simulacao-de-respostas';
import { TabelaDeCamposAvaliadosComponent } from './tabela-de-campos-avaliados';

/** Um formulário que a simulação pergunta e cujo resultado mostra. */
export interface FormularioParaSimular {
  readonly finalidade: string;
  /** Como o formulário é nomeado na frase "formulário de …" — só aparece quando há mais de um. */
  readonly nome: string;
  readonly conteudo: ConteudoDoFormulario;
}

/** Uma seção que o candidato já concluiu, no formulário da finalidade. */
export interface EtapaConcluida {
  readonly finalidade: string;
  readonly etapa: string;
}

export type { OcorrenciaSimulada } from './simulacao-de-grupos';

/** O perfil simulado: as respostas aos campos, os pressupostos, as seções concluídas e as ocorrências dos grupos. */
export interface SimulacaoDeFormularios {
  readonly respostas: Readonly<Record<string, unknown>>;
  readonly pressupostos: Readonly<Record<string, unknown>>;
  readonly etapasConcluidas: readonly EtapaConcluida[];
  /**
   * As ocorrências por código de grupo. Sem a chave, o grupo não foi respondido; com a lista vazia,
   * o candidato declarou que não há ocorrência. Nulo quando nenhum grupo foi respondido — sempre,
   * quando o hospedeiro não simula grupos.
   */
  readonly grupos: Readonly<Record<string, readonly OcorrenciaSimulada[]>> | null;
}

/** Um campo avaliado. Os estados são `VERDADEIRO`, `FALSO` ou `INDETERMINADO`. */
export interface ItemAvaliado {
  readonly fatoCodigo: string;
  readonly etapaCodigo: string | null;
  readonly visivel: string;
  readonly obrigatorio: string;
  readonly restricoesVioladas: readonly string[];
  readonly impedido: string;
  readonly mensagemDoImpedimento: string | null;
}

/** Um termo avaliado. */
export interface TermoAvaliado {
  readonly codigo: string;
  readonly visivel: string;
  readonly obrigatorio: string;
}

/** Uma ocorrência avaliada, pela identidade enviada, com os campos dela. */
export interface OcorrenciaAvaliada {
  readonly id: string;
  readonly itens: readonly ItemAvaliado[];
}

/**
 * Um grupo repetível avaliado. As ocorrências só são avaliadas com o grupo exibido; a contagem e a
 * ocorrência do candidato dizem se as ocorrências simuladas valem como resposta.
 */
export interface GrupoAvaliado {
  readonly codigo: string;
  readonly etapaCodigo: string | null;
  readonly visivel: string;
  readonly obrigatorio: string;
  readonly contagemValida: boolean;
  readonly ocorrenciaDoCandidatoValida: boolean;
  readonly ocorrencias: readonly OcorrenciaAvaliada[];
}

/** O formulário de uma finalidade avaliado contra o perfil simulado. */
export interface FormularioAvaliado {
  readonly finalidade: string;
  readonly itens: readonly ItemAvaliado[];
  readonly grupos: readonly GrupoAvaliado[];
  readonly termos: readonly TermoAvaliado[];
}

/** Pede à API a avaliação do que está gravado contra o perfil simulado. */
export type AvaliacaoDeFormularios = (simulacao: SimulacaoDeFormularios) => Observable<ApiResult<readonly FormularioAvaliado[]>>;

/**
 * A pré-visualização de formulários gravados (UNI-REQ-0145): quem configura simula as respostas do
 * candidato aos campos e aos pressupostos e vê, por campo e por termo, o que ele veria, o que seria
 * obrigatório e se a resposta impediria a inscrição, com a mensagem que ele leria. A avaliação é da
 * API — a mesma da inscrição —, por isso quem hospeda diz como pedi-la: o modelo da Configuração
 * avalia um formulário, o processo avalia os de todas as finalidades.
 *
 * O hospedeiro dá o título da seção. O resumo da avaliação é anunciado ao leitor de tela.
 */
@Component({
  selector: 'ui-pre-visualizacao-de-formularios',
  standalone: true,
  imports: [AlertComponent, RespostaSimuladaComponent, SpinnerComponent, TabelaDeCamposAvaliadosComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pre-visualizacao-formularios' },
  template: `
    <p class="field__hint">
      Simule as respostas do candidato e veja quais campos e termos ele veria, quais seriam obrigatórios,
      que restrição a resposta violaria e se a inscrição seria impedida. Deixe em branco o que ele não
      respondeu. {{ origem() }}
    </p>

    @if (fatos().length > 0) {
      <fieldset class="pre-visualizacao-formularios__respostas" [disabled]="carregando()">
        <legend class="field__label">Respostas simuladas</legend>
        @for (fato of fatos(); track fato.codigo) {
          <ui-resposta-simulada
            [fato]="fato"
            [controleId]="idDoFato(fato)"
            [rotulo]="fato.nome + (fato.origem === 'pressuposto' ? ' (de outro formulário)' : '')"
            [municipios]="municipiosRespondidos(fato)"
            [invalido]="invalidos().has(fato.codigo)"
            (respondida)="responder(fato, $event)"
          />
        }
      </fieldset>
    } @else if (simulaveis().length === 0) {
      @if (grupos().length === 0) {
        <p class="field__hint">O formulário ainda não tem campos para simular.</p>
      }
    } @else if (catalogo().length === 0) {
      <p class="field__hint">O catálogo de fatos ainda não está disponível: sem ele não é possível simular as respostas.</p>
    } @else {
      <p class="field__hint">Nenhum campo do formulário tem resposta que se simule aqui; o endereço, por exemplo, não é simulado.</p>
    }

    @for (grupo of grupos(); track grupo.codigo) {
      @let simulado = estadoDoGrupo(ocorrencias(), grupo.codigo);
      <fieldset class="pre-visualizacao-formularios__grupo" [disabled]="carregando()" [attr.aria-describedby]="idDoGrupo(grupo) + '-nota'">
        <legend class="field__label">{{ grupo.rotulo }} — grupo repetível{{ varios() ? ' (formulário de ' + nomeDe(grupo.finalidade) + ')' : '' }}</legend>
        <p class="field__hint" [id]="idDoGrupo(grupo) + '-nota'">{{ notaDoGrupo(grupo) }}</p>
        @for (ocorrencia of simulado.ocorrencias ?? []; track ocorrencia.sequencia; let posicao = $index) {
          <fieldset class="pre-visualizacao-formularios__respostas" [id]="idDaOcorrenciaNaTela(grupo, ocorrencia)">
            <legend class="field__label">Ocorrência {{ posicao + 1 }}{{ ehDoCandidato(ocorrencia) ? ' — o próprio candidato' : '' }}</legend>
            @for (campo of grupo.campos; track campo.codigo) {
              <ui-resposta-simulada
                [fato]="campo"
                [controleId]="idDaOcorrenciaNaTela(grupo, ocorrencia) + '-' + campo.codigo"
                [rotulo]="campo.nome"
                [municipios]="codigosIbge(ocorrencia.respostas.get(campo.codigo))"
                [invalido]="ocorrencia.invalidos.has(campo.codigo)"
                (respondida)="responderNaOcorrencia(grupo, ocorrencia, campo.codigo, $event)"
              />
            }
            <div class="pre-visualizacao-formularios__acoes">
              <button type="button" class="btn btn--tertiary btn--sm" (click)="remover(grupo, ocorrencia, posicao)">
                Remover a ocorrência {{ posicao + 1 }} de {{ grupo.rotulo }}
              </button>
            </div>
          </fieldset>
        }
        @if ((simulado.ocorrencias ?? []).length === 0) {
          <label class="checkbox">
            <input type="checkbox" [checked]="simulado.ocorrencias !== null" (change)="alternarSemOcorrencia(grupo)" />
            <span class="checkbox__box" aria-hidden="true"></span>
            O candidato declarou que não há nenhuma ocorrência
          </label>
        }
        <div class="pre-visualizacao-formularios__acoes">
          <button
            type="button"
            class="btn btn--secondary btn--sm"
            [id]="idDoGrupo(grupo) + '-acrescentar'"
            [disabled]="noLimite(ocorrencias(), grupo)"
            (click)="acrescentar(grupo)"
          >
            Acrescentar ocorrência a {{ grupo.rotulo }}
          </button>
          @if (noLimite(ocorrencias(), grupo)) {
            <span class="field__hint">O grupo admite no máximo {{ grupo.maximo }} ocorrência(s).</span>
          }
        </div>
      </fieldset>
    }

    <!-- Anuncia a remoção de ocorrência: o foco salta para outra, e quem não vê não saberia o que saiu. -->
    <p class="sr-only" aria-live="polite">{{ anuncio() }}</p>

    <fieldset class="pre-visualizacao-formularios__respostas" [disabled]="carregando()">
      <legend class="field__label">Etapas já concluídas pelo candidato</legend>
      <p class="field__hint">Numa etapa concluída, o campo opcional deixado em branco conta como respondido em branco.</p>
      @for (secao of secoes(); track secao.chave) {
        <label class="checkbox">
          <input type="checkbox" [checked]="concluidas().has(secao.chave)" (change)="alternarEtapa(secao.chave)" />
          <span class="checkbox__box" aria-hidden="true"></span>
          {{ secao.rotulo }}
        </label>
      }
    </fieldset>

    <div class="pre-visualizacao-formularios__acoes">
      <button
        type="button"
        class="btn btn--secondary"
        [disabled]="desatualizado() || carregando() || haInvalido()"
        [attr.aria-describedby]="desatualizado() ? idBase() + '-desatualizado' : haInvalido() ? idBase() + '-invalido' : null"
        (click)="preVisualizar()"
      >
        @if (carregando()) {
          <ui-spinner size="sm" />
        }
        Pré-visualizar
      </button>
      @if (desatualizado()) {
        <span class="field__hint" [id]="idBase() + '-desatualizado'">{{ textoDesatualizado() }}</span>
      } @else if (haInvalido()) {
        <span class="field__hint" [id]="idBase() + '-invalido'">Corrija os valores não reconhecidos para pré-visualizar.</span>
      }
    </div>

    <!-- A região de status fica no DOM mesmo vazia: criada junto com o texto, não seria anunciada. -->
    <p class="pre-visualizacao-formularios__resumo" role="status">{{ resumo() }}</p>

    @if (erroVisivel(); as falha) {
      <ui-alert variant="danger" heading="Não foi possível pré-visualizar">{{ falha }}</ui-alert>
    }

    @if (resultadoVisivel(); as avaliados) {
      @for (avaliado of avaliados; track avaliado.finalidade) {
        @if (varios()) {
          <h3 class="pre-visualizacao-formularios__formulario">Formulário de {{ nomeDe(avaliado.finalidade) }}</h3>
        }
        <ui-tabela-de-campos-avaliados
          [itens]="avaliado.itens"
          [legenda]="'Campos do formulário' + (varios() ? ' de ' + nomeDe(avaliado.finalidade) : '') + ' diante das respostas simuladas'"
          [rotuloDoCampo]="leitores().get(avaliado.finalidade)?.rotuloDoCampo ?? semRotulo"
          [tituloDaEtapa]="leitores().get(avaliado.finalidade)?.tituloDaEtapa ?? semRotulo"
        />

        @for (grupo of avaliado.grupos; track grupo.codigo) {
          @let definicao = grupoDe(grupo.codigo);
          @let rotulo = definicao?.rotulo ?? grupo.codigo;
          @let simuladas = (estadoDoGrupo(ocorrencias(), grupo.codigo).ocorrencias ?? []).length;
          @if (varios()) {
            <h4 class="pre-visualizacao-formularios__formulario">Grupo: {{ rotulo }}</h4>
          } @else {
            <h3 class="pre-visualizacao-formularios__formulario">Grupo: {{ rotulo }}</h3>
          }
          <dl class="pre-visualizacao-formularios__grupo-avaliado">
            <div>
              <dt>Seção</dt>
              <dd>{{ (leitores().get(avaliado.finalidade)?.tituloDaEtapa ?? semRotulo)(grupo.etapaCodigo) }}</dd>
            </div>
            <div>
              <dt>Exibido</dt>
              <dd>{{ estado(grupo.visivel) }}</dd>
            </div>
            <div>
              <dt>Obrigatório</dt>
              <dd>{{ estado(grupo.obrigatorio) }}</dd>
            </div>
            @if (grupo.visivel === 'VERDADEIRO') {
              <div>
                <dt>Quantidade de ocorrências</dt>
                <dd>{{ quantidadeAvaliada(grupo, definicao) }}</dd>
              </div>
              @if (definicao?.incluiCandidato && simuladas > 0) {
                <div>
                  <dt>Ocorrência do candidato</dt>
                  <dd>{{ grupo.ocorrenciaDoCandidatoValida ? 'Válida' : 'Inválida (falta, ou há mais de uma)' }}</dd>
                </div>
              }
            }
          </dl>
          @if (grupo.visivel !== 'VERDADEIRO' && simuladas > 0) {
            <p class="field__hint">As ocorrências simuladas só são avaliadas com o grupo exibido.</p>
          }
          @for (ocorrencia of grupo.ocorrencias; track ocorrencia.id; let posicao = $index) {
            <ui-tabela-de-campos-avaliados
              [itens]="ocorrencia.itens"
              [legenda]="'Campos da ocorrência ' + (posicao + 1) + ' do grupo ' + rotulo"
              [comSecao]="false"
              [rotuloDoCampo]="leitores().get(avaliado.finalidade)?.rotuloDoCampo ?? semRotulo"
            />
          }
        }

        @if (avaliado.termos.length > 0) {
          <div class="table-responsive">
            <table>
              <caption class="sr-only">Termos do formulário{{ varios() ? ' de ' + nomeDe(avaliado.finalidade) : '' }} diante das respostas simuladas</caption>
              <thead>
                <tr>
                  <th scope="col">Termo</th>
                  <th scope="col">Exibido</th>
                  <th scope="col">Obrigatório</th>
                </tr>
              </thead>
              <tbody>
                @for (termo of avaliado.termos; track termo.codigo) {
                  <tr>
                    <td data-label="Termo"><code>{{ termo.codigo }}</code></td>
                    <td data-label="Exibido">{{ estado(termo.visivel) }}</td>
                    <td data-label="Obrigatório">{{ estado(termo.obrigatorio) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    }
  `,
})
export class PreVisualizacaoDeFormulariosComponent {
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Os formulários que a simulação pergunta — os mesmos que a avaliação devolve. */
  readonly formularios = input.required<readonly FormularioParaSimular[]>();
  readonly catalogo = input.required<readonly FatoDoFormulario[]>();
  readonly avaliar = input.required<AvaliacaoDeFormularios>();
  /** Prefixo dos ids dos controles — único na tela. */
  readonly idBase = input.required<string>();
  /** O que a pré-visualização avalia, dito a quem a usa: o que está gravado, e não o que está na tela. */
  readonly origem = input.required<string>();
  /** Há alteração não salva que a avaliação precisaria ver: não se pré-visualiza. */
  readonly desatualizado = input<boolean>(false);
  readonly textoDesatualizado = input<string>('Salve para pré-visualizar as alterações.');
  /**
   * A avaliação do hospedeiro aceita as ocorrências dos grupos repetíveis. A do modelo da
   * Configuração não aceita: simular grupos ali não teria efeito, e os campos de grupo ficam de fora.
   */
  readonly simulaGrupos = input<boolean>(false);

  private readonly injector = inject(Injector);

  protected readonly varios = computed(() => this.formularios().length > 1);

  /**
   * Os campos dos formulários e os pressupostos. Uma regra pode citar um derivado, que a API resolve
   * a partir das respostas, e uma restrição confere a resposta do próprio campo — simular só os fatos
   * citados deixaria os dois de fora. Os campos de grupo ficam de fora: são respondidos por
   * ocorrência, em cada grupo.
   */
  protected readonly simulaveis = computed(() => {
    // A resposta é por fato: o pressuposto de um formulário que outro coleta é a mesma pergunta.
    const porCodigo = new Map<string, FatoSimulado['origem']>();
    for (const { conteudo } of this.formularios()) {
      // O item manda sobre o pressuposto, qualquer que seja a ordem dos formulários.
      for (const item of conteudo.itens ?? []) porCodigo.set(item.fatoCodigo, 'resposta');
      for (const codigo of conteudo.pressupostos ?? []) if (!porCodigo.has(codigo)) porCodigo.set(codigo, 'pressuposto');
    }
    return [...porCodigo].map(([codigo, origem]) => ({ codigo, origem }));
  });

  protected readonly fatos = computed<readonly FatoSimulado[]>(() => {
    const porCodigo = new Map(this.catalogo().map((fato) => [fato.codigo, fato]));
    return this.simulaveis().flatMap(({ codigo, origem }) => {
      const fato = porCodigo.get(codigo);
      // O endereço é valor estruturado, que nenhuma regra cita e que não se escreve num campo só.
      return fato === undefined || fato.dominio === 'ENDERECO' ? [] : [simulado(fato, origem)];
    });
  });

  /** Os grupos repetíveis que a simulação pergunta, quando a avaliação do hospedeiro os aceita. */
  protected readonly grupos = computed(() => (this.simulaGrupos() ? gruposSimulaveis(this.formularios(), this.catalogo()) : []));

  /** As seções de cada formulário, que o candidato pode ter concluído. */
  protected readonly secoes = computed(() =>
    this.formularios().flatMap(({ finalidade, nome, conteudo }) =>
      etapasEmOrdem(conteudo)
        .filter((etapa) => etapa.tipo === 'SECAO')
        .map((etapa) => ({
          chave: chaveDaEtapa(finalidade, etapa.codigo),
          concluida: { finalidade, etapa: etapa.codigo } satisfies EtapaConcluida,
          rotulo: this.varios() ? `${etapa.titulo} (formulário de ${nome})` : etapa.titulo,
        })),
    ),
  );

  /**
   * O que a simulação pergunta. As respostas valem enquanto as perguntas são as mesmas: a resposta
   * guardada de um campo que saiu seguiria no envio sem controle na tela.
   */
  private readonly perguntas = computed(() =>
    JSON.stringify([
      this.fatos().map((fato) => fato.codigo),
      this.secoes().map((secao) => secao.chave),
      this.grupos().map((grupo) => [grupo.codigo, grupo.campos.map((campo) => campo.codigo)]),
    ]),
  );

  private readonly respostas = linkedSignal<string, ReadonlyMap<string, unknown>>({
    source: () => this.perguntas(),
    computation: () => new Map(),
  });
  /** Os campos com valor escrito que não se reconhece no domínio do fato: não se simula o que não foi informado. */
  protected readonly invalidos = linkedSignal<string, ReadonlySet<string>>({
    source: () => this.perguntas(),
    computation: () => new Set(),
  });
  protected readonly concluidas = linkedSignal<string, ReadonlySet<string>>({
    source: () => this.perguntas(),
    computation: () => new Set(),
  });
  protected readonly ocorrencias = linkedSignal<string, SimulacaoDosGrupos>({
    source: () => this.perguntas(),
    computation: () => new Map(),
  });
  protected readonly haInvalido = computed(() => this.invalidos().size > 0 || haValorNaoReconhecido(this.ocorrencias()));
  protected readonly anuncio = signal('');

  protected readonly carregando = signal(false);
  /** A falha vale para os formulários avaliados, como o resultado. */
  protected readonly erro = linkedSignal<readonly FormularioParaSimular[], string | null>({
    source: () => this.formularios(),
    computation: () => null,
  });
  /** O resultado vale para os formulários e a simulação avaliados: mudar um ou outro o descarta. */
  protected readonly resultado = linkedSignal<readonly FormularioParaSimular[], readonly FormularioAvaliado[] | null>({
    source: () => this.formularios(),
    computation: () => null,
  });

  /** O resultado e a falha só aparecem enquanto o que está na tela é o que a API avaliou. */
  protected readonly resultadoVisivel = computed(() => (this.desatualizado() ? null : this.resultado()));
  protected readonly erroVisivel = computed(() => (this.desatualizado() ? null : this.erro()));

  protected readonly resumo = computed(() => {
    const avaliados = this.resultadoVisivel();
    return avaliados === null ? '' : resumoDaPreVisualizacao(avaliados);
  });

  /** A definição de cada grupo dos formulários, pelo código — único no processo inteiro. */
  private readonly definicoesDosGrupos = computed(
    () => new Map(gruposSimulaveis(this.formularios(), []).map((grupo) => [grupo.codigo, grupo])),
  );

  protected readonly estadoDoGrupo = estadoDoGrupo;
  protected readonly noLimite = noLimite;
  protected readonly ehDoCandidato = ehDoCandidato;

  protected idDoFato(fato: FatoSimulado): string {
    return `${this.idBase()}-simulacao-${fato.codigo}`;
  }

  protected estado(token: string): string {
    return rotuloDoEstado(token);
  }

  protected nomeDe(finalidade: string): string {
    return this.formularios().find((formulario) => formulario.finalidade === finalidade)?.nome ?? finalidade;
  }

  /** Como ler os campos e as seções de cada formulário no resultado: pelo rótulo e pelo título que o formulário dá. */
  protected readonly leitores = computed(
    () =>
      new Map(
        this.formularios().map(({ finalidade, conteudo }) => {
          const campos = todosOsCampos(conteudo);
          const etapas = conteudo.etapas ?? [];
          return [
            finalidade,
            {
              rotuloDoCampo: (fatoCodigo: string) => campos.find((campo) => campo.fatoCodigo === fatoCodigo)?.rotulo ?? fatoCodigo,
              tituloDaEtapa: (codigo: string | null) => (codigo === null ? '—' : (etapas.find((etapa) => etapa.codigo === codigo)?.titulo ?? codigo)),
            },
          ] as const;
        }),
      ),
  );

  /** O código como veio, para o formulário que a tela já não tem. */
  protected readonly semRotulo = (codigo: string | null): string => codigo ?? '—';

  protected responder(fato: FatoSimulado, { valor, invalido }: RespostaDada): void {
    this.invalidos.update((atual) => {
      const novos = new Set(atual);
      if (invalido) novos.add(fato.codigo);
      else novos.delete(fato.codigo);
      return novos;
    });
    this.respostas.update((atual) => comResposta(atual, fato.codigo, valor));
    this.descartarAvaliacao();
  }

  /** Os códigos IBGE respondidos, como o campo de município os mostra. */
  protected municipiosRespondidos(fato: FatoSimulado): readonly string[] {
    return this.codigosIbge(this.respostas().get(fato.codigo));
  }

  protected codigosIbge(resposta: unknown): readonly string[] {
    return Array.isArray(resposta) ? resposta : typeof resposta === 'string' ? [resposta] : [];
  }

  protected grupoDe(codigo: string): GrupoSimulavel | undefined {
    return this.definicoesDosGrupos().get(codigo);
  }

  protected idDoGrupo(grupo: GrupoSimulavel): string {
    return `${this.idBase()}-grupo-${grupo.codigo}`;
  }

  /** O id na tela leva a sequência, e não a identidade do envio, que tem caractere a escapar em seletor. */
  protected idDaOcorrenciaNaTela(grupo: GrupoSimulavel, ocorrencia: OcorrenciaEmSimulacao): string {
    return `${this.idDoGrupo(grupo)}-${ocorrencia.sequencia}`;
  }

  protected notaDoGrupo(grupo: GrupoSimulavel): string {
    const quantidade =
      grupo.maximo === null ? `Ao menos ${grupo.minimo} ocorrência(s), sem máximo.` : `De ${grupo.minimo} a ${grupo.maximo} ocorrência(s).`;
    const candidato = grupo.incluiCandidato ? ' Uma das ocorrências é a do próprio candidato, escolhida no parentesco.' : '';
    return `${quantidade}${candidato} Sem ocorrência e sem a declaração de que não há, o grupo fica sem resposta.`;
  }

  /** A quantidade avaliada, válida ou não segundo a API, com o limite do grupo quando não vale. */
  protected quantidadeAvaliada(grupo: GrupoAvaliado, definicao: GrupoSimulavel | undefined): string {
    if (estadoDoGrupo(this.ocorrencias(), grupo.codigo).ocorrencias === null) return 'Sem resposta: o grupo não foi simulado';
    const quantas = grupo.ocorrencias.length;
    if (grupo.contagemValida) return `${quantas} — dentro do limite`;
    if (definicao === undefined) return `${quantas} — fora do limite`;
    return definicao.maximo === null
      ? `${quantas} — fora do limite de ao menos ${definicao.minimo}`
      : `${quantas} — fora do limite de ${definicao.minimo} a ${definicao.maximo}`;
  }

  protected responderNaOcorrencia(grupo: GrupoSimulavel, ocorrencia: OcorrenciaEmSimulacao, fato: string, resposta: RespostaDada): void {
    this.ocorrencias.update((atual) => comRespostaNaOcorrencia(atual, grupo.codigo, ocorrencia.sequencia, fato, resposta));
    this.descartarAvaliacao();
  }

  protected acrescentar(grupo: GrupoSimulavel): void {
    const antes = this.ocorrencias();
    const depois = acrescentarOcorrencia(antes, grupo);
    if (depois === antes) return;
    this.ocorrencias.set(depois);
    this.descartarAvaliacao();
    // O leitor de tela lê a legenda da nova ocorrência ao entrar nela: o foco basta como anúncio.
    const nova = estadoDoGrupo(depois, grupo.codigo).ocorrencias?.at(-1);
    if (nova !== undefined) this.focarDepoisDeRenderizar(this.idDaOcorrenciaNaTela(grupo, nova));
  }

  /**
   * Remove a ocorrência e leva o foco à que assumiu a posição dela, ou à anterior, ou, sem nenhuma,
   * ao botão de acrescentar — nunca ao corpo da página.
   */
  protected remover(grupo: GrupoSimulavel, ocorrencia: OcorrenciaEmSimulacao, posicao: number): void {
    const depois = removerOcorrencia(this.ocorrencias(), grupo.codigo, ocorrencia.sequencia);
    this.ocorrencias.set(depois);
    this.descartarAvaliacao();
    const restantes = estadoDoGrupo(depois, grupo.codigo).ocorrencias ?? [];
    const destino = restantes[posicao] ?? restantes[posicao - 1];
    this.focarDepoisDeRenderizar(
      destino === undefined ? `${this.idDoGrupo(grupo)}-acrescentar` : this.idDaOcorrenciaNaTela(grupo, destino),
      `Ocorrência ${posicao + 1} removida de ${grupo.rotulo}.`,
    );
  }

  protected alternarSemOcorrencia(grupo: GrupoSimulavel): void {
    const declarado = estadoDoGrupo(this.ocorrencias(), grupo.codigo).ocorrencias !== null;
    this.ocorrencias.update((atual) => declararSemOcorrencia(atual, grupo.codigo, !declarado));
    this.descartarAvaliacao();
  }

  protected alternarEtapa(chave: string): void {
    this.concluidas.update((atual) => {
      const nova = new Set(atual);
      if (!nova.delete(chave)) nova.add(chave);
      return nova;
    });
    this.descartarAvaliacao();
  }

  protected preVisualizar(): void {
    if (this.desatualizado() || this.carregando() || this.haInvalido()) return;
    // Só é pressuposto o fato que nenhum formulário avaliado coleta: o campo da inscrição que a
    // habilitação pressupõe é resposta da inscrição, e enviado como pressuposto ficaria sem resposta.
    const pressupostos = new Set(this.simulaveis().filter(({ origem }) => origem === 'pressuposto').map(({ codigo }) => codigo));
    const respostas: Record<string, unknown> = {};
    const conhecidos: Record<string, unknown> = {};
    for (const [codigo, valor] of this.respostas()) {
      (pressupostos.has(codigo) ? conhecidos : respostas)[codigo] = valor;
    }
    const etapasConcluidas = this.secoes()
      .filter((secao) => this.concluidas().has(secao.chave))
      .map((secao) => secao.concluida);
    this.carregando.set(true);
    this.erro.set(null);
    // A região de status passa pelo vazio: um resumo igual ao anterior não seria anunciado de novo.
    this.resultado.set(null);
    const avaliados = this.formularios();
    const grupos = this.simulaGrupos() ? gruposDoEnvio(this.ocorrencias()) : null;
    this.avaliar()({ respostas, pressupostos: conhecidos, etapasConcluidas, grupos })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.carregando.set(false);
        // Os formulários mudaram durante o pedido: a resposta é dos anteriores.
        if (this.formularios() !== avaliados) return;
        if (resultado.ok) {
          this.resultado.set(resultado.data);
          return;
        }
        this.resultado.set(null);
        this.erro.set(this.problemI18n.resolve(resultado.problem).title);
      });
  }

  /**
   * Leva o foco ao primeiro controle do elemento — ou ao próprio elemento, quando ele é o controle —
   * depois que a tela mostra a mudança. O anúncio passa pelo vazio, para repetir o texto anterior.
   */
  private focarDepoisDeRenderizar(id: string, anuncio?: string): void {
    if (anuncio !== undefined) this.anuncio.set('');
    afterNextRender(
      () => {
        const alvo = document.getElementById(id);
        const controle = alvo?.matches('button, input, select') ? alvo : alvo?.querySelector<HTMLElement>('input, select, button');
        controle?.focus();
        if (anuncio !== undefined) this.anuncio.set(anuncio);
      },
      { injector: this.injector },
    );
  }

  /** A simulação mudou: o resultado e a falha eram dos valores anteriores. */
  private descartarAvaliacao(): void {
    this.resultado.set(null);
    this.erro.set(null);
  }
}

/** A seção pela finalidade e pelo código: o mesmo código de seção pode existir em dois formulários. */
function chaveDaEtapa(finalidade: string, etapa: string): string {
  return JSON.stringify([finalidade, etapa]);
}
