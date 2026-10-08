import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CampoDoCandidatoComponent } from './campo-do-candidato';
import {
  type CampoNoPasso,
  comoInteiro,
  fatoDaUf,
  type GrupoNoPasso,
} from './formulario-do-candidato.model';
import type { OcorrenciaSimulada, ValorJson } from './interpretador/regras-do-formulario';

/** O parentesco que identifica a ocorrência do próprio candidato no grupo que o inclui. */
const FATO_PARENTESCO = 'PARENTESCO';
const PROPRIO_CANDIDATO = 'PROPRIO_CANDIDATO';

interface OcorrenciaNaTela {
  readonly id: string;
  readonly titulo: string;
  readonly doCandidato: boolean;
  readonly campos: readonly CampoNoPasso[];
  readonly respostas: Readonly<Record<string, ValorJson>>;
}

/**
 * Um grupo repetível, como a composição familiar: cada ocorrência com os campos dela, e acrescentar ou
 * remover ocorrência dentro do mínimo e do máximo. No grupo de mínimo zero, o candidato pode declarar
 * que não há ocorrência — a lista vazia é resposta, diferente de não responder. No grupo que inclui o
 * candidato, a ocorrência dele nasce com o parentesco de próprio candidato e não sai da lista.
 */
@Component({
  selector: 'ui-grupo-do-candidato',
  standalone: true,
  imports: [CampoDoCandidatoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="formulario-candidato__grupo" [attr.aria-describedby]="descritoPor()">
      <legend class="field__label" [class.is-required]="obrigatorio()">{{ grupo().rotulo }}</legend>
      <p class="field__hint" [id]="id() + '-limites'">{{ limites() }}</p>

      @if (ocorrencias() === undefined) {
        <!-- Sem resposta ainda: nenhuma ocorrência na lista. -->
      } @else if (naTela().length === 0 && minimo() === 0) {
        <p class="formulario-candidato__declaracao">
          Declarado: não há {{ grupo().rotulo.toLocaleLowerCase('pt-BR') }}.
        </p>
        <button
          type="button"
          class="btn btn--tertiary btn--sm"
          (click)="ocorrenciasChange.emit(undefined)"
        >
          Desfazer a declaração
        </button>
      }

      @for (ocorrencia of naTela(); track ocorrencia.id; let i = $index) {
        <section
          class="formulario-candidato__ocorrencia"
          [attr.aria-labelledby]="id() + '-' + i + '-titulo'"
        >
          <h4 class="formulario-candidato__ocorrencia-titulo" [id]="id() + '-' + i + '-titulo'">
            {{ ocorrencia.titulo }}
          </h4>
          @for (campo of ocorrencia.campos; track campo.campo.fatoCodigo) {
            <ui-campo-do-candidato
              [noPasso]="campo"
              [id]="id() + '-' + i + '-' + campo.campo.fatoCodigo"
              [resposta]="ocorrencia.respostas[campo.campo.fatoCodigo]"
              [respostaDaUf]="respostaDaUf(campo, ocorrencia.respostas)"
              [mostrarPendencia]="mostrarPendencia()"
              (respondida)="responder(i, campo.campo.fatoCodigo, $event)"
            />
          }
          @if (!ocorrencia.doCandidato) {
            <button type="button" class="btn btn--tertiary btn--sm" (click)="remover(i)">
              Remover {{ ocorrencia.titulo }}
            </button>
          }
        </section>
      }

      <div class="formulario-candidato__acoes-do-grupo">
        @if (grupo().incluiCandidato && !temOcorrenciaDoCandidato()) {
          <button
            type="button"
            class="btn btn--secondary btn--sm"
            [disabled]="cheio()"
            (click)="acrescentar(true)"
          >
            Incluir você na lista
          </button>
        } @else {
          <button
            type="button"
            class="btn btn--secondary btn--sm"
            [disabled]="cheio()"
            (click)="acrescentar(false)"
          >
            Acrescentar a {{ grupo().rotulo.toLocaleLowerCase('pt-BR') }}
          </button>
        }
        @if (minimo() === 0 && naTela().length === 0 && ocorrencias() === undefined) {
          <button
            type="button"
            class="btn btn--tertiary btn--sm"
            (click)="ocorrenciasChange.emit([])"
          >
            Declarar que não há {{ grupo().rotulo.toLocaleLowerCase('pt-BR') }}
          </button>
        }
      </div>

      @if (problemas().length > 0) {
        <span class="field__error" [id]="id() + '-erro'">
          @for (problema of problemas(); track problema) {
            {{ problema }}
          }
        </span>
      }
    </fieldset>
  `,
})
export class GrupoDoCandidatoComponent {
  readonly noPasso = input.required<GrupoNoPasso>();
  /** As ocorrências respondidas; `undefined` é o grupo ainda sem resposta. */
  readonly ocorrencias = input<readonly OcorrenciaSimulada[] | undefined>(undefined);
  /** As respostas do candidato fora do grupo, para a UF de um campo de município. */
  readonly respostasDoCandidato = input<Readonly<Record<string, ValorJson>>>({});
  readonly id = input.required<string>();
  readonly mostrarPendencia = input<boolean>(false);

  readonly ocorrenciasChange = output<readonly OcorrenciaSimulada[] | undefined>();

  protected readonly grupo = computed(() => this.noPasso().grupo);
  protected readonly obrigatorio = computed(
    () => this.noPasso().avaliado.obrigatorio === 'VERDADEIRO',
  );
  private readonly lista = computed(() => this.ocorrencias() ?? []);
  /** O mínimo e o máximo de ocorrências, como números; o máximo nulo é sem limite. */
  protected readonly minimo = computed(() => comoInteiro(this.grupo().minimo));
  protected readonly maximo = computed(() => {
    const maximo = this.grupo().maximo;
    return maximo === null || maximo === undefined ? null : comoInteiro(maximo);
  });
  protected readonly cheio = computed(() => {
    const maximo = this.maximo();
    return maximo !== null && this.lista().length >= maximo;
  });
  /**
   * A ocorrência do candidato: a primeira com o parentesco de próprio candidato, no grupo que o inclui.
   * Outra com o mesmo parentesco é um integrante como os demais, que se corrige ou remove.
   */
  private readonly indiceDoCandidato = computed(() => {
    if (!this.grupo().incluiCandidato) return null;
    const indice = this.lista().findIndex(ehDoCandidato);
    return indice < 0 ? null : indice;
  });
  protected readonly temOcorrenciaDoCandidato = computed(() => this.indiceDoCandidato() !== null);

  protected readonly limites = computed(() => {
    const minimo = this.minimo();
    const maximo = this.maximo();
    if (maximo !== null)
      return minimo === maximo ? `Informe ${minimo}.` : `Informe de ${minimo} a ${maximo}.`;
    return minimo > 0 ? `Informe ao menos ${minimo}.` : 'Informe quantos houver.';
  });

  /** Cada ocorrência com os campos que aparecem nela, na ordem do grupo. */
  protected readonly naTela = computed<readonly OcorrenciaNaTela[]>(() => {
    const { grupo, avaliado, regras } = this.noPasso();
    const subitens = [...grupo.subitens].sort(
      (a, b) => comoInteiro(a.ordem) - comoInteiro(b.ordem),
    );
    const indiceDoCandidato = this.indiceDoCandidato();
    let integrante = 0;
    return this.lista().map((ocorrencia, i) => {
      const doCandidato = i === indiceDoCandidato;
      if (!doCandidato) integrante++;
      const avaliados = new Map(
        (avaliado.ocorrencias[i]?.campos ?? []).map((c) => [c.fatoCodigo, c]),
      );
      return {
        id: ocorrencia.id,
        titulo: doCandidato ? 'Você (candidato)' : `${grupo.rotulo} ${integrante}`,
        doCandidato,
        respostas: ocorrencia.respostas ?? {},
        campos: subitens.flatMap((campo): CampoNoPasso[] => {
          const avaliadoDoCampo = avaliados.get(campo.fatoCodigo);
          // O parentesco da ocorrência do candidato é fixo: não se pergunta.
          if (doCandidato && campo.fatoCodigo === FATO_PARENTESCO) return [];
          if (!avaliadoDoCampo || avaliadoDoCampo.visivel !== 'VERDADEIRO') return [];
          // Com o candidato já na lista, o parentesco dos outros integrantes não oferece o próprio candidato.
          const semOCandidato = indiceDoCandidato !== null && campo.fatoCodigo === FATO_PARENTESCO;
          return [
            {
              campo: semOCandidato
                ? {
                    ...campo,
                    valoresSelecionaveis: campo.valoresSelecionaveis?.filter(
                      (v) => v.codigo !== PROPRIO_CANDIDATO,
                    ),
                  }
                : campo,
              avaliado:
                semOCandidato && avaliadoDoCampo.opcoes
                  ? {
                      ...avaliadoDoCampo,
                      opcoes: {
                        ...avaliadoDoCampo.opcoes,
                        codigos: avaliadoDoCampo.opcoes.codigos?.filter(
                          (c) => c !== PROPRIO_CANDIDATO,
                        ),
                      },
                    }
                  : avaliadoDoCampo,
              regra: regras.get(campo.fatoCodigo) ?? null,
            },
          ];
        }),
      };
    });
  });

  protected readonly problemas = computed(() => {
    const { avaliado } = this.noPasso();
    return [
      ...(this.mostrarPendencia() && this.obrigatorio() && this.ocorrencias() === undefined
        ? ['Responda este grupo.']
        : []),
      ...(avaliado.contagemValida ? [] : [this.limites()]),
      ...(avaliado.ocorrenciaDoCandidatoValida ? [] : ['Inclua você na lista uma única vez.']),
    ];
  });

  protected readonly descritoPor = computed(() =>
    [`${this.id()}-limites`, ...(this.problemas().length > 0 ? [`${this.id()}-erro`] : [])].join(
      ' ',
    ),
  );

  protected respostaDaUf(
    campo: CampoNoPasso,
    daOcorrencia: Readonly<Record<string, ValorJson>>,
  ): ValorJson | undefined {
    const fato = fatoDaUf(campo.regra);
    return fato === null ? undefined : (daOcorrencia[fato] ?? this.respostasDoCandidato()[fato]);
  }

  protected acrescentar(doCandidato: boolean): void {
    const nova: OcorrenciaSimulada = {
      id: crypto.randomUUID(),
      respostas: doCandidato ? { [FATO_PARENTESCO]: PROPRIO_CANDIDATO } : {},
    };
    this.ocorrenciasChange.emit(doCandidato ? [nova, ...this.lista()] : [...this.lista(), nova]);
  }

  /** Remover o último integrante volta o grupo a sem resposta: declarar que não há é uma escolha à parte. */
  protected remover(indice: number): void {
    const restantes = this.lista().filter((_, i) => i !== indice);
    this.ocorrenciasChange.emit(restantes.length === 0 ? undefined : restantes);
  }

  protected responder(indice: number, fato: string, valor: ValorJson | undefined): void {
    this.ocorrenciasChange.emit(
      this.lista().map((ocorrencia, i) => {
        if (i !== indice) return ocorrencia;
        const respostas = { ...(ocorrencia.respostas ?? {}) };
        if (valor === undefined) delete respostas[fato];
        else respostas[fato] = valor;
        return { ...ocorrencia, respostas };
      }),
    );
  }
}

function ehDoCandidato(ocorrencia: OcorrenciaSimulada): boolean {
  return ocorrencia.respostas?.[FATO_PARENTESCO] === PROPRIO_CANDIDATO;
}
