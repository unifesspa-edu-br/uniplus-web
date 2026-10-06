import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Subscription } from 'rxjs';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { AvaliacoesDeFormularioApi } from '@uniplus/shared-data/configuracao';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import {
  AlertComponent,
  BUSCA_DE_MUNICIPIOS,
  FormularioDoCandidatoComponent,
  baixarJson,
  casoDaSimulacao,
  divergenciasEntre,
  interpretarFormulario,
  lerArquivoDoFormulario,
  type ArquivoDoFormulario,
  type AvaliacaoDoFormulario,
  type Divergencia,
  type SimulacaoDoFormulario,
} from '@uniplus/shared-ui/components';

type Conferencia =
  | { readonly estado: 'conferindo' }
  | {
      readonly estado: 'feita';
      readonly divergencias: readonly Divergencia[];
      readonly simulacao: SimulacaoDoFormulario;
    }
  | { readonly estado: 'falha'; readonly mensagem: string };

/**
 * O simulador de formulário a partir de um arquivo: um formulário renderizável exportado de um modelo
 * ou de um processo, ou um caso do corpus compartilhado com a API. Simula a inscrição sem cadastro
 * nenhum — nada é enviado ao importar nem gravado ao responder —, e "Conferir com o servidor" leva as
 * regras e as respostas à avaliação sem cadastro da API, que é a autoridade, para mostrar onde o
 * interpretador decidiu diferente.
 */
@Component({
  selector: 'cfg-simulador-de-formulario-page',
  standalone: true,
  imports: [AlertComponent, FormularioDoCandidatoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // O campo de município escolhe o município pela busca no Geo, limitada à UF respondida.
  providers: [{ provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo }],
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Simulador de formulário</h1>
        <p class="page-header__desc">
          Abra um formulário exportado de um modelo ou de um processo, ou um caso de teste do
          formulário, e responda como o candidato responderia.
        </p>
      </div>
    </div>

    <p class="aviso-de-simulacao" role="note">
      <i class="pi pi-info-circle" aria-hidden="true"></i>
      Simulação: nada é gravado. Recarregar a página ou sair dela descarta as respostas.
    </p>

    <div class="field simulador-formulario__arquivo">
      <label class="field__label" for="simulador-arquivo">Arquivo JSON do formulário</label>
      <input
        id="simulador-arquivo"
        class="input"
        type="file"
        accept="application/json,.json"
        [attr.aria-invalid]="recusaDoArquivo() ? 'true' : null"
        [attr.aria-describedby]="
          recusaDoArquivo() ? 'simulador-arquivo-erro' : 'simulador-arquivo-ajuda'
        "
        (change)="importar($event)"
      />
      @if (recusaDoArquivo(); as recusa) {
        <span class="field__error" id="simulador-arquivo-erro"
          >{{ recusa.mensagem }} (em {{ recusa.caminho }})</span
        >
      } @else {
        <span class="field__hint" id="simulador-arquivo-ajuda"
          >O arquivo é lido só no navegador: nada é enviado ao abri-lo.</span
        >
      }
    </div>

    @if (arquivo(); as aberto) {
      @if (aberto.valido) {
        <div class="simulador-formulario__acoes">
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="conferencia()?.estado === 'conferindo'"
            (click)="conferir()"
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
                  O servidor é a autoridade: cada divergência é uma regra que a simulação lê de
                  outro jeito.
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

        <ui-formulario-do-candidato
          idBase="simulador"
          [formulario]="aberto.formulario"
          [inicial]="aberto.simulacao"
          [pressupostos]="aberto.simulacao?.pressupostos ?? {}"
          (simulacaoChange)="simulacao.set($event)"
        />
      }
    }
  `,
})
export class SimuladorDeFormularioPage {
  private readonly avaliacoes = inject(AvaliacoesDeFormularioApi);
  private readonly problemas = inject(ProblemI18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly arquivo = signal<ArquivoDoFormulario | null>(null);
  protected readonly simulacao = signal<SimulacaoDoFormulario>({});
  protected readonly conferencia = signal<Conferencia | null>(null);
  /** A conferência em voo: outro arquivo a cancela, para a resposta antiga não cair sobre o novo. */
  private conferenciaEmVoo: Subscription | null = null;

  protected readonly recusaDoArquivo = computed(() => {
    const arquivo = this.arquivo();
    return arquivo && !arquivo.valido ? arquivo : null;
  });

  /** A avaliação que o interpretador faz agora, para conferir e para exportar como caso. */
  protected readonly avaliacaoLocal = computed<AvaliacaoDoFormulario | null>(() => {
    const arquivo = this.arquivo();
    if (!arquivo?.valido) return null;
    const interpretacao = interpretarFormulario(arquivo.formulario.regras, this.simulacao());
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

  /** O arquivo escolhido por último: uma leitura mais lenta de um arquivo anterior não o substitui. */
  private importacao = 0;

  protected async importar(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    if (!arquivo) return;
    // Sem limpar a escolha, o mesmo arquivo, corrigido e escolhido de novo, não dispara outra leitura.
    entrada.value = '';
    const esta = ++this.importacao;
    this.conferenciaEmVoo?.unsubscribe();
    this.conferencia.set(null);
    this.simulacao.set({});
    let lido: ArquivoDoFormulario;
    try {
      lido = lerArquivoDoFormulario(await textoDo(arquivo));
    } catch {
      lido = {
        valido: false,
        caminho: '(arquivo)',
        mensagem: 'Não foi possível ler o arquivo escolhido.',
      };
    }
    if (esta === this.importacao) this.arquivo.set(lido);
  }

  /**
   * Envia as regras e as respostas à avaliação sem cadastro e compara com o que o interpretador decidiu
   * para as mesmas respostas.
   */
  protected conferir(): void {
    const arquivo = this.arquivo();
    if (!arquivo?.valido) return;
    const simulacao = this.simulacao();
    this.conferencia.set({ estado: 'conferindo' });
    this.conferenciaEmVoo?.unsubscribe();
    this.conferenciaEmVoo = this.avaliacoes
      .avaliar({
        regras: arquivo.formulario.regras,
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
        const local = interpretarFormulario(arquivo.formulario.regras, simulacao);
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
    const arquivo = this.arquivo();
    if (arquivo?.valido) baixarJson('formulario.json', arquivo.formulario);
  }

  protected exportarCaso(): void {
    const arquivo = this.arquivo();
    const avaliacao = this.avaliacaoLocal();
    if (arquivo?.valido && avaliacao)
      baixarJson(
        'caso.json',
        casoDaSimulacao(arquivo.formulario.regras, this.simulacao(), avaliacao),
      );
  }
}

/** O texto do arquivo escolhido, lido no navegador. */
function textoDo(arquivo: Blob): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver(String(leitor.result ?? ''));
    leitor.onerror = () => rejeitar(leitor.error);
    leitor.readAsText(arquivo);
  });
}
