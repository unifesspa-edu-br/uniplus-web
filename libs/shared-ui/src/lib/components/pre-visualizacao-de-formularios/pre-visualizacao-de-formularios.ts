import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemI18nService, type ApiResult } from '@uniplus/shared-core/http';
import type { Observable } from 'rxjs';

import { AlertComponent } from '../alert/alert';
import { etapasEmOrdem, todosOsCampos, type ConteudoDoFormulario, type FatoDoFormulario } from '../editor-de-formulario/formulario-editavel';
import { SpinnerComponent } from '../spinner/spinner';
import { rotuloDoEstado } from './estado-avaliado';
import { RespostaSimuladaComponent, type RespostaDada } from './resposta-simulada';
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

/** O perfil simulado: as respostas aos campos, os pressupostos e as seções concluídas. */
export interface SimulacaoDeFormularios {
  readonly respostas: Readonly<Record<string, unknown>>;
  readonly pressupostos: Readonly<Record<string, unknown>>;
  readonly etapasConcluidas: readonly EtapaConcluida[];
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

/** O formulário de uma finalidade avaliado contra o perfil simulado. */
export interface FormularioAvaliado {
  readonly finalidade: string;
  readonly itens: readonly ItemAvaliado[];
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
      <p class="field__hint">O formulário ainda não tem campos para simular.</p>
    } @else if (catalogo().length === 0) {
      <p class="field__hint">O catálogo de fatos ainda não está disponível: sem ele não é possível simular as respostas.</p>
    } @else {
      <p class="field__hint">Nenhum campo do formulário tem resposta que se simule aqui; o endereço, por exemplo, não é simulado.</p>
    }

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
        [disabled]="desatualizado() || carregando() || invalidos().size > 0"
        [attr.aria-describedby]="desatualizado() ? idBase() + '-desatualizado' : invalidos().size > 0 ? idBase() + '-invalido' : null"
        (click)="preVisualizar()"
      >
        @if (carregando()) {
          <ui-spinner size="sm" />
        }
        Pré-visualizar
      </button>
      @if (desatualizado()) {
        <span class="field__hint" [id]="idBase() + '-desatualizado'">{{ textoDesatualizado() }}</span>
      } @else if (invalidos().size > 0) {
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

  protected readonly varios = computed(() => this.formularios().length > 1);

  /**
   * Os campos dos formulários e os pressupostos. Uma regra pode citar um derivado, que a API resolve
   * a partir das respostas, e uma restrição confere a resposta do próprio campo — simular só os fatos
   * citados deixaria os dois de fora. Os campos de grupo ficam de fora: a resposta simulada é por
   * fato, não por ocorrência de grupo, e não teria efeito.
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
  private readonly perguntas = computed(
    () => `${this.fatos().map((fato) => fato.codigo).join(',')}|${this.secoes().map((secao) => secao.chave).join(',')}`,
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
    if (avaliados === null) return '';
    const itens = avaliados.flatMap((avaliado) => avaliado.itens);
    const exibidos = itens.filter((item) => item.visivel === 'VERDADEIRO').length;
    const obrigatorios = itens.filter((item) => item.obrigatorio === 'VERDADEIRO').length;
    const impedimentos = itens.filter((item) => item.impedido === 'VERDADEIRO').length;
    const impede = impedimentos > 0 ? ` A inscrição seria impedida por ${impedimentos} resposta(s).` : '';
    return `Pré-visualização pronta: ${exibidos} de ${itens.length} campos exibidos, ${obrigatorios} obrigatórios.${impede}`;
  });

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
    const resposta = this.respostas().get(fato.codigo);
    return Array.isArray(resposta) ? resposta : typeof resposta === 'string' ? [resposta] : [];
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
    if (this.desatualizado() || this.carregando() || this.invalidos().size > 0) return;
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
    this.avaliar()({ respostas, pressupostos: conhecidos, etapasConcluidas })
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
