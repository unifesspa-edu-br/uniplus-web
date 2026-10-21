import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { type ArquivoEmEnvio, FileUploadComponent } from '../file-upload/file-upload';
import { TagComponent } from '../tag/tag';
import type { DocumentoExigido } from '../lista-de-documentos/lista-de-documentos';
import {
  type AlvoDoEnvio,
  type ArquivoEnviado,
  type EnvioDeDocumentos,
  type SituacaoDaExigencia,
  regrasDoArquivo,
} from './envio-de-documentos';

const TEXTO_DA_SITUACAO: Readonly<Record<SituacaoDaExigencia, string>> = {
  SATISFEITA: 'Satisfeita',
  PENDENTE: 'Pendente',
};

const FALHA_AO_REMOVER = 'Não foi possível remover o arquivo. Tente novamente.';

let proximoId = 0;

/**
 * O envio dos arquivos de UMA exigência de documento: escolher por teclado ou arrastando, acompanhar o
 * progresso, ver o que foi enviado e remover enquanto a inscrição é rascunho. A tela não fala com a API:
 * o `EnvioDeDocumentos` de quem hospeda faz o caminho até o armazenamento.
 */
@Component({
  selector: 'ui-envio-do-documento',
  standalone: true,
  imports: [FileUploadComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .envio-do-documento {
      display: grid;
      gap: var(--space-2);
      margin-block-start: var(--space-2);
    }
    .envio-do-documento__cabeca {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }
    .envio-do-documento__cabeca p,
    .envio-do-documento__dica {
      margin: 0;
    }
    .envio-do-documento__dica {
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }
  `,
  template: `
    <div class="envio-do-documento">
      <div class="envio-do-documento__cabeca">
        @if (situacao(); as situacao) {
          <ui-tag [variant]="situacao === 'SATISFEITA' ? 'success' : 'warning'">
            {{ textoDaSituacao(situacao) }}
          </ui-tag>
        }
        @if (quantidadeMinima() > 1) {
          <p class="envio-do-documento__dica" [attr.id]="idDaDica">
            Envie {{ quantidadeMinima() }} arquivos para este documento.
          </p>
        }
      </div>
      <ui-file-upload
        [fieldLabel]="'Enviar ' + alvo().nome"
        [nomeDaLista]="alvo().nome"
        [itens]="itensDaLista()"
        [multiple]="true"
        [validarSoPelaExtensao]="true"
        [disabled]="!podeAlterar()"
        [acceptedFileTypes]="regras().extensoes"
        [allowedMimeTypes]="regras().tiposDeMidia"
        [acceptLabel]="regras().rotuloDosFormatos"
        [maxSizeMb]="regras().tamanhoMaximoMb"
        [descritoPor]="quantidadeMinima() > 1 ? idDaDica : null"
        [mensagemExterna]="falhaAoRemover()"
        (arquivosEscolhidos)="enviarTodos($event)"
        (tentarDeNovo)="tentarDeNovo($event)"
        (itemRetirado)="retirar($event)"
      />
    </div>
  `,
})
export class EnvioDoDocumentoComponent {
  private destruido = false;
  protected readonly idDaDica = `envio-do-documento-dica-${++proximoId}`;

  /** A exigência a que os arquivos desta lista atendem. */
  readonly alvo = input.required<AlvoDoEnvio>();
  readonly formatos = input.required<DocumentoExigido['formatos']>();
  /** O limite de tamanho de cada arquivo, como a API o informa para a exigência. */
  readonly tamanhoMaximoBytes = input.required<number>();
  /** Quantas apresentações a exigência pede, no mínimo; acima de 1, a tela diz quantas enviar. */
  readonly quantidadeMinima = input(1, { transform: (v: number | null | undefined) => v ?? 1 });
  readonly envio = input.required<EnvioDeDocumentos>();
  /** Os arquivos que a API já registrou para esta exigência, além dos que o próprio envio confirmou. */
  readonly arquivos = input<readonly ArquivoEnviado[]>([]);
  /** Se a avaliação já disse que a exigência está atendida; nula, nada se afirma. */
  readonly situacao = input<SituacaoDaExigencia | null>(null);
  /** Enviar e remover só valem enquanto a inscrição é rascunho. */
  readonly podeAlterar = input(true);

  /** Um arquivo foi confirmado: quem hospeda reavalia as exigências. */
  readonly arquivoEnviado = output<ArquivoEnviado>();
  readonly arquivoRemovido = output<string>();

  protected readonly regras = computed(() =>
    regrasDoArquivo(this.formatos(), this.tamanhoMaximoBytes()),
  );

  /** Os arquivos em andamento ou com falha, que a API ainda não registrou. */
  private readonly emAndamento = signal<readonly ArquivoEmEnvio[]>([]);
  /** Os arquivos cuja remoção está em curso: um segundo clique não dispara outra. */
  /** Os arquivos já removidos: a avaliação que os trazia só muda quando é refeita. */
  private readonly removidos = signal<ReadonlySet<string>>(new Set());
  private readonly removendo = signal<ReadonlySet<string>>(new Set());
  protected readonly falhaAoRemover = signal<string | null>(null);
  /** Os bytes de cada arquivo em andamento, para a nova tentativa; não é estado da tela. */
  private readonly bytes = new Map<string, File>();
  private proximoLocal = 0;

  protected readonly itensDaLista = computed<readonly ArquivoEmEnvio[]>(() => {
    const removendo = this.removendo();
    const doServidor = new Map<string, ArquivoEnviado>();
    const confirmadosPeloEnvio = this.envio()
      .arquivos()
      .filter((a) => a.chave === this.alvo().chave);
    for (const arquivo of [...this.arquivos(), ...confirmadosPeloEnvio]) {
      if (!this.removidos().has(arquivo.arquivoId)) doServidor.set(arquivo.arquivoId, arquivo);
    }
    const confirmados = [...doServidor.values()].map(
      (arquivo): ArquivoEmEnvio => ({
        id: arquivo.arquivoId,
        nome: arquivo.nome || nomeGenerico(arquivo.tipoDeMidia),
        tamanhoBytes: arquivo.tamanhoBytes,
        fase: 'confirmado',
        progresso: 100,
        podeRetirar: this.podeAlterar() && !removendo.has(arquivo.arquivoId),
      }),
    );
    const podeAlterar = this.podeAlterar();
    const locais = this.emAndamento().map(
      (a): ArquivoEmEnvio => ({
        ...a,
        podeRetirar: podeAlterar,
        podeTentarDeNovo: a.podeTentarDeNovo !== false && podeAlterar,
      }),
    );
    return [...confirmados, ...locais];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destruido = true));
  }

  protected textoDaSituacao(situacao: SituacaoDaExigencia): string {
    return TEXTO_DA_SITUACAO[situacao];
  }

  protected enviarTodos(arquivos: readonly File[]): void {
    this.falhaAoRemover.set(null);
    for (const arquivo of arquivos) {
      const id = `envio-${this.proximoLocal++}`;
      this.bytes.set(id, arquivo);
      this.emAndamento.update((lista) => [
        ...lista,
        { id, nome: arquivo.name, tamanhoBytes: arquivo.size, fase: 'iniciando', progresso: 0 },
      ]);
      void this.enviar(id);
    }
  }

  protected tentarDeNovo(id: string): void {
    if (!this.podeAlterar()) return;
    this.falhaAoRemover.set(null);
    void this.enviar(id);
  }

  protected async retirar(id: string): Promise<void> {
    this.falhaAoRemover.set(null);
    if (this.emAndamento().some((a) => a.id === id)) {
      this.bytes.delete(id);
      this.emAndamento.update((lista) => lista.filter((a) => a.id !== id));
      return;
    }
    if (this.removendo().has(id)) return;
    this.removendo.update((atual) => new Set(atual).add(id));
    const desfecho = await this.envio().remover(id);
    if (this.destruido) return;
    this.removendo.update((atual) => {
      const restantes = new Set(atual);
      restantes.delete(id);
      return restantes;
    });
    if (!desfecho.ok) {
      this.falhaAoRemover.set(desfecho.mensagem || FALHA_AO_REMOVER);
      return;
    }
    this.removidos.update((atual) => new Set(atual).add(id));
    this.arquivoRemovido.emit(id);
  }

  private async enviar(id: string): Promise<void> {
    const arquivo = this.bytes.get(id);
    if (arquivo === undefined) return;
    this.atualizar(id, { fase: 'iniciando', progresso: 0, mensagem: null });
    const desfecho = await this.envio().enviar(this.alvo(), arquivo, (fase, progresso) =>
      this.atualizar(id, { fase, progresso }),
    );
    if (!this.bytes.has(id)) {
      // O candidato retirou o arquivo enquanto ele subia: o envio terminou, e o que ele pediu foi tirar.
      if (desfecho.ok) await this.descartar(desfecho.arquivo.arquivoId);
      return;
    }
    if (this.destruido) return;
    if (!desfecho.ok) {
      this.atualizar(id, {
        fase: 'erro',
        mensagem: desfecho.mensagem,
        podeTentarDeNovo: desfecho.podeTentarDeNovo && this.podeAlterar(),
      });
      return;
    }
    this.bytes.delete(id);
    this.emAndamento.update((lista) => lista.filter((a) => a.id !== id));
    this.arquivoEnviado.emit(desfecho.arquivo);
  }

  /** Remove o arquivo que o candidato já tinha retirado quando o envio terminou. */
  private async descartar(arquivoId: string): Promise<void> {
    const desfecho = await this.envio().remover(arquivoId);
    if (!this.destruido && !desfecho.ok)
      this.falhaAoRemover.set(desfecho.mensagem || FALHA_AO_REMOVER);
  }

  private atualizar(id: string, alteracao: Partial<ArquivoEmEnvio>): void {
    this.emAndamento.update((lista) =>
      lista.map((a) => (a.id === id ? { ...a, ...alteracao } : a)),
    );
  }
}

function nomeGenerico(tipoDeMidia: string): string {
  const formato = tipoDeMidia.split('/')[1]?.toUpperCase() ?? '';
  return formato ? `Arquivo enviado (${formato})` : 'Arquivo enviado';
}
