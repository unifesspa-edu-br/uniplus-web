import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AvaliacoesDeFormularioApi } from '@uniplus/shared-data/configuracao';
import {
  SimulacaoDeFormularioComponent,
  lerArquivoDoFormulario,
  type ArquivoDoFormulario,
  type ConferenciaComOServidor,
} from '@uniplus/shared-ui/components';
import { ENDERECO_NO_GEO } from '../../shared/endereco';

/**
 * O simulador de formulário a partir de um arquivo: um formulário renderizável exportado de um modelo
 * ou de um processo, ou um caso do corpus compartilhado com a API. Simula a inscrição sem cadastro
 * nenhum — nada é enviado ao abrir o arquivo nem gravado ao responder —, e confere com a avaliação sem
 * cadastro da API, que é a autoridade.
 */
@Component({
  selector: 'cfg-simulador-de-formulario-page',
  standalone: true,
  imports: [SimulacaoDeFormularioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // O campo de município escolhe o município pela busca no Geo, limitada à UF respondida.
  providers: [ENDERECO_NO_GEO],
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
        <ui-simulacao-de-formulario
          idBase="simulador"
          [formulario]="aberto.formulario"
          [inicial]="aberto.simulacao"
          [conferir]="conferir"
        />
      }
    }
  `,
})
export class SimuladorDeFormularioPage {
  private readonly avaliacoes = inject(AvaliacoesDeFormularioApi);

  protected readonly arquivo = signal<ArquivoDoFormulario | null>(null);
  protected readonly recusaDoArquivo = computed(() => {
    const arquivo = this.arquivo();
    return arquivo && !arquivo.valido ? arquivo : null;
  });

  protected readonly conferir: ConferenciaComOServidor = (simulacao) =>
    this.avaliacoes.avaliar(simulacao);

  /** O arquivo escolhido por último: uma leitura mais lenta de um arquivo anterior não o substitui. */
  private importacao = 0;

  protected async importar(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const arquivo = entrada.files?.[0];
    if (!arquivo) return;
    // Sem limpar a escolha, o mesmo arquivo, corrigido e escolhido de novo, não dispara outra leitura.
    entrada.value = '';
    const esta = ++this.importacao;
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
