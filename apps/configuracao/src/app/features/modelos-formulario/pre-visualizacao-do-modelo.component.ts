import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import {
  ModelosFormularioApi,
  type FatoCandidatoView,
  type PreVisualizacaoDoModeloDto,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  SpinnerComponent,
  etapasEmOrdem,
  fatoEscolhivel,
  todosOsCampos,
  type ConteudoDoFormulario,
} from '@uniplus/shared-ui/components';

/** Como o candidato responderia um campo do formulário ou um pressuposto, na simulação. */
interface FatoSimulado {
  readonly codigo: string;
  readonly nome: string;
  /** Resposta de um campo deste formulário, ou fato pressuposto de outro formulário. */
  readonly origem: 'resposta' | 'pressuposto';
  readonly controle: 'booleano' | 'numero' | 'data' | 'lista' | 'texto';
  readonly multiplo: boolean;
  /** O domínio, para converter cada valor escrito no tipo que a API compara. */
  readonly dominio: string;
  readonly valores: readonly string[];
}

const ESTADOS: Readonly<Record<string, string>> = {
  VERDADEIRO: 'Sim',
  FALSO: 'Não',
  INDETERMINADO: 'Depende de resposta ainda não dada',
};

/**
 * A pré-visualização do modelo GRAVADO (UNI-REQ-0145): o administrador simula as respostas aos
 * campos do formulário e aos pressupostos e vê, por campo e por termo, o que o candidato veria. A avaliação é a
 * da API — a mesma da inscrição —, e o resumo é anunciado ao leitor de tela.
 */
@Component({
  selector: 'cfg-pre-visualizacao-do-modelo',
  standalone: true,
  imports: [AlertComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel cfg-pre-visualizacao" aria-labelledby="cfg-pre-visualizacao-titulo">
      <div class="panel-head">
        <div class="panel-head__title"><h2 id="cfg-pre-visualizacao-titulo">Pré-visualização</h2></div>
      </div>

      <p class="field__hint">
        Simule as respostas do candidato e veja quais campos e termos ele veria, quais seriam obrigatórios,
        que restrição a resposta violaria e se a inscrição seria impedida. Deixe em branco o que ele não
        respondeu. A pré-visualização usa o modelo gravado.
      </p>

      @if (fatos().length > 0) {
        <fieldset class="cfg-pre-visualizacao__respostas" [disabled]="carregando()">
          <legend class="field__label">Respostas simuladas</legend>
          @for (fato of fatos(); track fato.codigo) {
            <div class="field">
              <label class="field__label" [for]="'cfg-simulacao-' + fato.codigo">
                {{ fato.nome }}{{ fato.origem === 'pressuposto' ? ' (de outro formulário)' : '' }}
              </label>
              @switch (fato.controle) {
                @case ('booleano') {
                  <select class="select" [id]="'cfg-simulacao-' + fato.codigo" (change)="responder(fato, valorDe($event))">
                    <option value="">Sem resposta</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                }
                @case ('numero') {
                  <input
                    class="input"
                    type="text"
                    inputmode="numeric"
                    [id]="'cfg-simulacao-' + fato.codigo"
                    [attr.aria-invalid]="invalidos().has(fato.codigo) ? 'true' : null"
                    [attr.aria-describedby]="invalidos().has(fato.codigo) ? 'cfg-simulacao-' + fato.codigo + '-nota' : null"
                    (input)="responder(fato, valorDe($event))"
                  />
                  @if (invalidos().has(fato.codigo)) {
                    <span class="field__error" [id]="'cfg-simulacao-' + fato.codigo + '-nota'">Valor não reconhecido. Escreva um número inteiro.</span>
                  }
                }
                @case ('data') {
                  <input class="input" type="date" [id]="'cfg-simulacao-' + fato.codigo" (input)="responder(fato, valorDe($event))" />
                }
                @case ('lista') {
                  <select
                    class="select"
                    [id]="'cfg-simulacao-' + fato.codigo"
                    [multiple]="fato.multiplo"
                    (change)="responderLista(fato, $event)"
                  >
                    @if (!fato.multiplo) {
                      <option value="">Sem resposta</option>
                    }
                    @for (valor of fato.valores; track valor) {
                      <option [value]="valor">{{ valor }}</option>
                    }
                  </select>
                }
                @default {
                  <input
                    class="input"
                    type="text"
                    [id]="'cfg-simulacao-' + fato.codigo"
                    [attr.aria-invalid]="invalidos().has(fato.codigo) ? 'true' : null"
                    [attr.aria-describedby]="fato.multiplo ? 'cfg-simulacao-' + fato.codigo + '-nota' : null"
                    (input)="responder(fato, valorDe($event))"
                  />
                  @if (fato.multiplo) {
                    <span
                      [class]="invalidos().has(fato.codigo) ? 'field__error' : 'field__hint'"
                      [id]="'cfg-simulacao-' + fato.codigo + '-nota'"
                    >
                      {{ invalidos().has(fato.codigo) ? 'Valor não reconhecido. ' : '' }}{{ dicaDosValores(fato) }}
                    </span>
                  }
                }
              }
            </div>
          }
        </fieldset>
      } @else if (simulaveis().length > 0) {
        <p class="field__hint">Sem o catálogo de fatos não é possível simular as respostas.</p>
      } @else {
        <p class="field__hint">O modelo ainda não tem campos para simular.</p>
      }

      <fieldset class="cfg-pre-visualizacao__respostas" [disabled]="carregando()">
        <legend class="field__label">Etapas já concluídas pelo candidato</legend>
        <p class="field__hint">Numa etapa concluída, o campo opcional deixado em branco conta como respondido em branco.</p>
        @for (etapa of secoes(); track etapa.codigo) {
          <label class="checkbox">
            <input type="checkbox" [checked]="concluidas().has(etapa.codigo)" (change)="alternarEtapa(etapa.codigo)" />
            <span class="checkbox__box" aria-hidden="true"></span>
            {{ etapa.titulo }}
          </label>
        }
      </fieldset>

      <div class="cfg-form-footer">
        <button
          type="button"
          class="btn btn--secondary"
          [disabled]="desatualizado() || carregando() || invalidos().size > 0"
          [attr.aria-describedby]="desatualizado() ? 'cfg-pre-visualizacao-desatualizado' : invalidos().size > 0 ? 'cfg-pre-visualizacao-invalido' : null"
          (click)="preVisualizar()"
        >
          @if (carregando()) {
            <ui-spinner size="sm" />
          }
          Pré-visualizar
        </button>
        @if (desatualizado()) {
          <span class="field__hint" id="cfg-pre-visualizacao-desatualizado">Salve para pré-visualizar as alterações.</span>
        } @else if (invalidos().size > 0) {
          <span class="field__hint" id="cfg-pre-visualizacao-invalido">Corrija os valores não reconhecidos para pré-visualizar.</span>
        }
      </div>

      <p class="cfg-pre-visualizacao__resumo" role="status">{{ resumo() }}</p>

      @if (erro()) {
        <ui-alert variant="danger" heading="Não foi possível pré-visualizar">{{ erro() }}</ui-alert>
      }

      @if (resultadoVisivel(); as r) {
        <div class="table-responsive">
          <table>
            <caption class="sr-only">Campos do formulário diante das respostas simuladas</caption>
            <thead>
              <tr>
                <th scope="col">Campo</th>
                <th scope="col">Seção</th>
                <th scope="col">Exibido</th>
                <th scope="col">Obrigatório</th>
                <th scope="col">Impede a inscrição</th>
                <th scope="col">Restrição violada</th>
              </tr>
            </thead>
            <tbody>
              @for (item of r.itens; track item.fatoCodigo) {
                <tr>
                  <td data-label="Campo">{{ rotuloDoCampo(item.fatoCodigo) }}</td>
                  <td data-label="Seção">{{ tituloDaEtapa(item.etapaCodigo) }}</td>
                  <td data-label="Exibido">{{ estado(item.visivel) }}</td>
                  <td data-label="Obrigatório">{{ estado(item.obrigatorio) }}</td>
                  <td data-label="Impede a inscrição">
                    {{ estado(item.impedido) }}
                    @if (item.impedido === 'VERDADEIRO' && item.mensagemDoImpedimento) {
                      <span class="cfg-meta">{{ item.mensagemDoImpedimento }}</span>
                    }
                  </td>
                  <td data-label="Restrição violada">{{ item.restricoesVioladas.join(', ') || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (r.termos.length > 0) {
          <div class="table-responsive">
            <table>
              <caption class="sr-only">Termos do formulário diante das respostas simuladas</caption>
              <thead>
                <tr>
                  <th scope="col">Termo</th>
                  <th scope="col">Exibido</th>
                  <th scope="col">Obrigatório</th>
                </tr>
              </thead>
              <tbody>
                @for (termo of r.termos; track termo.codigo) {
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
    </section>
  `,
})
export class PreVisualizacaoDoModeloComponent {
  private readonly api = inject(ModelosFormularioApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly modeloId = input.required<string>();
  /** O conteúdo gravado — o que a API avalia. */
  readonly conteudo = input.required<ConteudoDoFormulario>();
  readonly catalogo = input.required<readonly FatoCandidatoView[]>();
  /** Há alteração não salva: o resultado não refletiria o que está na tela. */
  readonly desatualizado = input<boolean>(false);

  // A simulação pertence ao conteúdo gravado: gravado de novo, recomeça — uma resposta guardada de
  // campo que saiu do formulário seguiria no envio sem controle na tela.
  private readonly respostas = linkedSignal<ConteudoDoFormulario, ReadonlyMap<string, unknown>>({
    source: () => this.conteudo(),
    computation: () => new Map(),
  });
  /** Os campos com valor escrito que não se reconhece no domínio do fato: não se simula o que não foi informado. */
  protected readonly invalidos = linkedSignal<ConteudoDoFormulario, ReadonlySet<string>>({
    source: () => this.conteudo(),
    computation: () => new Set(),
  });
  protected readonly concluidas = linkedSignal<ConteudoDoFormulario, ReadonlySet<string>>({
    source: () => this.conteudo(),
    computation: () => new Set(),
  });
  protected readonly carregando = signal(false);
  /** A falha da pré-visualização vale para o conteúdo avaliado, como o resultado. */
  protected readonly erro = linkedSignal<ConteudoDoFormulario, string | null>({
    source: () => this.conteudo(),
    computation: () => null,
  });
  /** O resultado vale para o conteúdo e a simulação avaliados: gravar de novo ou mudar uma resposta o descarta. */
  protected readonly resultado = linkedSignal<ConteudoDoFormulario, PreVisualizacaoDoModeloDto | null>({
    source: () => this.conteudo(),
    computation: () => null,
  });

  protected readonly secoes = computed(() => etapasEmOrdem(this.conteudo()).filter((etapa) => etapa.tipo === 'SECAO'));

  /**
   * Os campos do formulário e os pressupostos. Uma regra pode citar um derivado, que a API resolve a
   * partir das respostas, e uma restrição confere a resposta do próprio campo — simular só os fatos
   * citados deixaria os dois de fora. Os campos de grupo ficam de fora: a pré-visualização da API não
   * recebe respostas por ocorrência de grupo, e a resposta simulada não teria efeito.
   */
  protected readonly simulaveis = computed(() => {
    const conteudo = this.conteudo();
    return [
      ...(conteudo.itens ?? []).map((item) => ({ codigo: item.fatoCodigo, origem: 'resposta' as const })),
      ...(conteudo.pressupostos ?? []).map((codigo) => ({ codigo, origem: 'pressuposto' as const })),
    ];
  });

  protected readonly fatos = computed<readonly FatoSimulado[]>(() => {
    const porCodigo = new Map(this.catalogo().map((fato) => [fato.codigo, fato]));
    return this.simulaveis().flatMap(({ codigo, origem }) => {
      const fato = porCodigo.get(codigo);
      // O endereço é valor estruturado, que nenhuma regra cita e que não se escreve num campo só.
      return fato === undefined || fato.dominio === 'ENDERECO' ? [] : [simulado(fato, origem)];
    });
  });

  /** O resultado só aparece enquanto o rascunho na tela é o modelo gravado que a API avaliou. */
  protected readonly resultadoVisivel = computed(() => (this.desatualizado() ? null : this.resultado()));

  protected readonly resumo = computed(() => {
    const r = this.resultadoVisivel();
    if (r === null) return '';
    const exibidos = r.itens.filter((item) => item.visivel === 'VERDADEIRO').length;
    const obrigatorios = r.itens.filter((item) => item.obrigatorio === 'VERDADEIRO').length;
    const impedimentos = r.itens.filter((item) => item.impedido === 'VERDADEIRO').length;
    const impede = impedimentos > 0 ? ` A inscrição seria impedida por ${impedimentos} resposta(s).` : '';
    return `Pré-visualização pronta: ${exibidos} de ${r.itens.length} campos exibidos, ${obrigatorios} obrigatórios.${impede}`;
  });

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected estado(token: string): string {
    return ESTADOS[token] ?? token;
  }

  protected rotuloDoCampo(fatoCodigo: string): string {
    return todosOsCampos(this.conteudo()).find((campo) => campo.fatoCodigo === fatoCodigo)?.rotulo ?? fatoCodigo;
  }

  protected tituloDaEtapa(codigo: string): string {
    return (this.conteudo().etapas ?? []).find((etapa) => etapa.codigo === codigo)?.titulo ?? codigo;
  }

  /** A resposta em texto, como o controle a dá, no JSON que a API compara; vazio é sem resposta. */
  protected responder(fato: FatoSimulado, texto: string): void {
    let valor: unknown =
      texto.trim() === ''
        ? undefined
        : fato.controle === 'booleano'
          ? texto === 'true'
          : fato.controle === 'numero'
            ? valorNoDominio('NUMERICO', texto.trim())
            : fato.multiplo
              ? texto
                  .split(';')
                  .map((parte) => parte.trim())
                  .filter((parte) => parte !== '')
                  .map((parte) => valorNoDominio(fato.dominio, parte))
              : texto;
    // Só separadores, sem valor nenhum, é sem resposta — a lista vazia diria que ele respondeu.
    if (Array.isArray(valor) && valor.length === 0) valor = undefined;
    const invalido = valor === NAO_RECONHECIDO || (Array.isArray(valor) && valor.includes(NAO_RECONHECIDO));
    this.invalidos.update((atual) => {
      const novos = new Set(atual);
      if (invalido) novos.add(fato.codigo);
      else novos.delete(fato.codigo);
      return novos;
    });
    this.respostas.update((atual) => comResposta(atual, fato.codigo, invalido ? undefined : valor));
    this.descartarAvaliacao();
  }

  protected dicaDosValores(fato: FatoSimulado): string {
    // Ponto e vírgula, e não vírgula, que é a separação decimal em pt-BR.
    if (fato.dominio === 'BOOLEANO') return 'Escreva sim ou não, separados por ponto e vírgula.';
    if (fato.dominio === 'NUMERICO') return 'Escreva números inteiros, separados por ponto e vírgula.';
    return 'Separe os valores por ponto e vírgula.';
  }

  protected responderLista(fato: FatoSimulado, evento: Event): void {
    const select = evento.target as HTMLSelectElement;
    if (!fato.multiplo) {
      this.responder(fato, select.value);
      return;
    }
    const escolhidos = Array.from(select.selectedOptions, (opcao) => opcao.value);
    this.respostas.update((atual) => comResposta(atual, fato.codigo, escolhidos.length === 0 ? undefined : escolhidos));
    this.descartarAvaliacao();
  }

  /** A simulação mudou: o resultado e a falha eram dos valores anteriores. */
  private descartarAvaliacao(): void {
    this.resultado.set(null);
    this.erro.set(null);
  }

  protected alternarEtapa(codigo: string): void {
    this.concluidas.update((atual) => {
      const nova = new Set(atual);
      if (!nova.delete(codigo)) nova.add(codigo);
      return nova;
    });
    this.descartarAvaliacao();
  }

  protected preVisualizar(): void {
    if (this.desatualizado() || this.carregando() || this.invalidos().size > 0) return;
    const pressupostos = new Set(this.conteudo().pressupostos ?? []);
    const respostas: Record<string, unknown> = {};
    const conhecidos: Record<string, unknown> = {};
    for (const [codigo, valor] of this.respostas()) {
      (pressupostos.has(codigo) ? conhecidos : respostas)[codigo] = valor;
    }
    this.carregando.set(true);
    this.erro.set(null);
    // A região de status passa pelo vazio: um resumo igual ao anterior não seria anunciado de novo.
    this.resultado.set(null);
    const avaliado = this.conteudo();
    this.api
      .preVisualizar(this.modeloId(), { respostas, etapasConcluidas: [...this.concluidas()], pressupostos: conhecidos })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.carregando.set(false);
        // O modelo foi gravado de novo durante o pedido: a resposta é do conteúdo anterior.
        if (this.conteudo() !== avaliado) return;
        if (resultado.ok) {
          this.resultado.set(resultado.data);
          return;
        }
        this.resultado.set(null);
        this.erro.set(this.problemI18n.resolve(resultado.problem).title);
      });
  }
}

function simulado(fato: FatoCandidatoView, origem: FatoSimulado['origem']): FatoSimulado {
  const escolhivel = fatoEscolhivel(fato);
  const multiplo = fato.cardinalidade === 'MULTIVALORADO';
  // Vários sim/não ou vários números não cabem num controle de valor único: são escritos separados por ponto e vírgula.
  const controle: FatoSimulado['controle'] =
    multiplo && escolhivel?.tipoDominio !== 'CATEGORICO_ESTATICO'
      ? 'texto'
      : fato.dominio === 'BOOLEANO'
      ? 'booleano'
      : fato.dominio === 'NUMERICO'
        ? 'numero'
        : fato.dominio === 'DATA'
          ? 'data'
          : escolhivel?.tipoDominio === 'CATEGORICO_ESTATICO'
          ? 'lista'
          : 'texto';
  return {
    codigo: fato.codigo,
    nome: fato.nome,
    origem,
    controle,
    multiplo,
    dominio: fato.dominio,
    valores: escolhivel?.valores ?? [],
  };
}

const NAO_RECONHECIDO = Symbol('não reconhecido');
const SIM = new Set(['sim', 'true']);
const NAO = new Set(['não', 'nao', 'false']);
/** O inteiro na gramática do JSON, a mesma que a condição sobre fato numérico aceita. */
const INTEIRO = /^-?(0|[1-9]\d*)$/u;

/** O valor escrito no tipo do domínio, ou a marca de não reconhecido — nunca outro valor no lugar. */
function valorNoDominio(dominio: string, texto: string): unknown {
  const normalizado = texto.toLocaleLowerCase('pt-BR');
  if (dominio === 'BOOLEANO') return SIM.has(normalizado) ? true : NAO.has(normalizado) ? false : NAO_RECONHECIDO;
  if (dominio === 'NUMERICO') return INTEIRO.test(texto) ? Number(texto) : NAO_RECONHECIDO;
  return texto;
}

function comResposta(atual: ReadonlyMap<string, unknown>, codigo: string, valor: unknown): ReadonlyMap<string, unknown> {
  const nova = new Map(atual);
  if (valor === undefined) nova.delete(codigo);
  else nova.set(codigo, valor);
  return nova;
}
