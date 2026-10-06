import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProblemI18nService, type ApiResult } from '@uniplus/shared-core/http';
import type { Observable, Subscription } from 'rxjs';

import { AlertComponent } from '../alert/alert';
import { casoDaSimulacao } from './arquivo-do-formulario';
import { baixarJson } from './baixar-json';
import { divergenciasEntre, type Divergencia } from './divergencias';
import {
  FormularioDoCandidatoComponent,
  type DocumentoDoFormulario,
} from './formulario-do-candidato';
import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import { interpretarFormulario } from './interpretador/interpretador';
import type {
  AvaliacaoDoFormulario,
  RegrasDoFormulario,
  SimulacaoDoFormulario,
  ValorJson,
} from './interpretador/regras-do-formulario';
import { PressupostosDaSimulacaoComponent } from './pressupostos-da-simulacao';

/** As regras e a simulação, como a avaliação sem cadastro da API as recebe. */
export interface SimulacaoParaConferir {
  readonly regras: RegrasDoFormulario;
  readonly respostas: Readonly<Record<string, ValorJson>> | null;
  readonly grupos: NonNullable<SimulacaoDoFormulario['grupos']> | null;
  readonly etapasConcluidas: readonly string[] | null;
  readonly pressupostos: Readonly<Record<string, ValorJson>> | null;
}

/**
 * A avaliação autoritativa da simulação. A biblioteca não fala com a API: quem hospeda a simulação passa
 * a chamada da avaliação sem cadastro.
 */
export type ConferenciaComOServidor = (
  simulacao: SimulacaoParaConferir,
) => Observable<ApiResult<AvaliacaoDoFormulario>>;

type Conferencia =
  | { readonly estado: 'conferindo' }
  | {
      readonly estado: 'feita';
      readonly divergencias: readonly Divergencia[];
      readonly simulacao: SimulacaoDoFormulario;
    }
  | { readonly estado: 'falha'; readonly mensagem: string };

/**
 * A simulação de um formulário, comum ao simulador por arquivo e às simulações de um modelo e de um
 * processo: o aviso fixo de que nada é gravado, os pressupostos, o formulário do candidato, a conferência
 * com o servidor — a autoridade — e a exportação do formulário e da simulação como caso de teste.
 */
@Component({
  selector: 'ui-simulacao-de-formulario',
  standalone: true,
  imports: [AlertComponent, FormularioDoCandidatoComponent, PressupostosDaSimulacaoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="aviso-de-simulacao" role="note">
      <i class="pi pi-info-circle" aria-hidden="true"></i>
      Simulação: nada é gravado. Recarregar a página ou sair dela descarta as respostas.
    </p>

    <div class="simulador-formulario__acoes">
      <button
        type="button"
        class="btn btn--primary"
        [disabled]="conferencia()?.estado === 'conferindo'"
        (click)="conferirComOServidor()"
      >
        Conferir com o servidor
      </button>
      <button type="button" class="btn btn--secondary" (click)="exportarFormulario()">
        Exportar o formulário
      </button>
      <button
        type="button"
        class="btn btn--secondary"
        [disabled]="avaliacaoLocal() === null"
        (click)="exportarCaso()"
      >
        Exportar como caso de teste
      </button>
    </div>

    <div class="simulador-formulario__conferencia" aria-live="polite">
      @switch (conferencia()?.estado) {
        @case ('conferindo') {
          <p>Conferindo com o servidor…</p>
        }
        @case ('falha') {
          <ui-alert variant="danger" heading="O servidor não conferiu a simulação">{{
            mensagemDaFalha()
          }}</ui-alert>
        }
        @case ('feita') {
          @if (conferenciaDesatualizada()) {
            <ui-alert variant="warning" [dynamic]="false"
              >As respostas mudaram desde a última conferência.</ui-alert
            >
          }
          @if (divergencias().length === 0) {
            <ui-alert variant="success" heading="Sem divergência"
              >O servidor decidiu o mesmo que a simulação.</ui-alert
            >
          } @else {
            <ui-alert variant="warning" heading="O servidor decidiu diferente">
              O servidor é a autoridade: cada divergência é uma regra que a simulação lê de outro
              jeito.
            </ui-alert>
            <div class="table-responsive">
              <table class="table">
                <caption class="sr-only">
                  Divergências entre a simulação e o servidor
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Onde</th>
                    <th scope="col">O quê</th>
                    <th scope="col">Simulação</th>
                    <th scope="col">Servidor</th>
                  </tr>
                </thead>
                <tbody>
                  @for (divergencia of divergencias(); track $index) {
                    <tr>
                      <td>{{ divergencia.onde }}</td>
                      <td>{{ divergencia.propriedade }}</td>
                      <td>
                        <code>{{ divergencia.interpretador }}</code>
                      </td>
                      <td>
                        <code>{{ divergencia.servidor }}</code>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      }
    </div>

    <ui-pressupostos-da-simulacao
      [idBase]="idBase() + '-pressupostos'"
      [pressupostos]="formulario().pressupostos ?? []"
      [valores]="pressupostos()"
      (valoresChange)="pressupostos.set($event)"
    />

    <ui-formulario-do-candidato
      [idBase]="idBase()"
      [formulario]="formulario()"
      [inicial]="inicial()"
      [pressupostos]="pressupostos()"
      [documentos]="documentos()"
      (simulacaoChange)="simulacao.set($event)"
    />
  `,
})
export class SimulacaoDeFormularioComponent {
  private readonly problemas = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly formulario = input.required<FormularioDoCandidato>();
  /** As respostas de partida, como as de um caso importado. */
  readonly inicial = input<SimulacaoDoFormulario | null>(null);
  readonly documentos = input<readonly DocumentoDoFormulario[] | null>(null);
  readonly conferir = input.required<ConferenciaComOServidor>();
  /** O nome do arquivo exportado, sem a extensão. */
  readonly nomeDoArquivo = input<string>('formulario');
  readonly idBase = input<string>('simulacao');

  private readonly partida = computed(() => ({
    formulario: this.formulario(),
    inicial: this.inicial(),
  }));
  /** Os pressupostos informados; recomeçam, com os do caso, a cada partida nova. */
  protected readonly pressupostos = linkedSignal<unknown, Readonly<Record<string, ValorJson>>>({
    source: this.partida,
    computation: () => ({ ...(this.inicial()?.pressupostos ?? {}) }),
  });
  protected readonly simulacao = signal<SimulacaoDoFormulario>({});
  protected readonly conferencia = linkedSignal<unknown, Conferencia | null>({
    source: this.partida,
    computation: () => null,
  });
  /** A conferência em voo: uma partida nova a cancela, para a resposta antiga não cair sobre ela. */
  private conferenciaEmVoo: Subscription | null = null;

  /** A avaliação que o interpretador faz agora, para conferir e para exportar como caso. */
  protected readonly avaliacaoLocal = computed<AvaliacaoDoFormulario | null>(() => {
    const interpretacao = interpretarFormulario(this.formulario().regras, this.simulacao());
    return interpretacao.valida ? interpretacao.avaliacao : null;
  });
  protected readonly divergencias = computed(() => {
    const conferencia = this.conferencia();
    return conferencia?.estado === 'feita' ? conferencia.divergencias : [];
  });
  protected readonly conferenciaDesatualizada = computed(() => {
    const conferencia = this.conferencia();
    return conferencia?.estado === 'feita' && conferencia.simulacao !== this.simulacao();
  });
  protected readonly mensagemDaFalha = computed(() => {
    const conferencia = this.conferencia();
    return conferencia?.estado === 'falha' ? conferencia.mensagem : '';
  });

  constructor() {
    effect(() => {
      this.partida();
      untracked(() => this.conferenciaEmVoo?.unsubscribe());
    });
  }

  /**
   * Envia as regras e as respostas à avaliação sem cadastro e compara com o que o interpretador decidiu
   * para as mesmas respostas.
   */
  protected conferirComOServidor(): void {
    const regras = this.formulario().regras;
    const simulacao = this.simulacao();
    this.conferencia.set({ estado: 'conferindo' });
    this.conferenciaEmVoo?.unsubscribe();
    this.conferenciaEmVoo = this.conferir()({
      regras,
      respostas: simulacao.respostas ?? null,
      grupos: simulacao.grupos ?? null,
      etapasConcluidas: simulacao.etapasConcluidas ?? null,
      pressupostos: simulacao.pressupostos ?? null,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (!resultado.ok) {
          const mensagem = this.problemas.resolve(resultado.problem);
          this.conferencia.set({ estado: 'falha', mensagem: mensagem.detail ?? mensagem.title });
          return;
        }
        const local = interpretarFormulario(regras, simulacao);
        this.conferencia.set(
          local.valida
            ? {
                estado: 'feita',
                simulacao,
                divergencias: divergenciasEntre(local.avaliacao, resultado.data),
              }
            : {
                estado: 'falha',
                mensagem: `A simulação não interpreta as regras que o servidor aceitou: ${local.erro.mensagem} (em ${local.erro.caminho}).`,
              },
        );
      });
  }

  protected exportarFormulario(): void {
    baixarJson(`${this.nomeDoArquivo()}.json`, this.formulario());
  }

  protected exportarCaso(): void {
    const avaliacao = this.avaliacaoLocal();
    if (avaliacao)
      baixarJson(
        `${this.nomeDoArquivo()}.caso.json`,
        casoDaSimulacao(this.formulario().regras, this.simulacao(), avaliacao),
      );
  }
}
