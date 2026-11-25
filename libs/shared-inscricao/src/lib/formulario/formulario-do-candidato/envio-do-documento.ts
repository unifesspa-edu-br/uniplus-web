import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { type ArquivoEmEnvio, FileUploadComponent } from '@uniplus/shared-ui/components';
import { TagComponent } from '@uniplus/shared-ui/components';
import type { DocumentoExigido } from '../lista-de-documentos/lista-de-documentos';
import {
  type AlvoDoEnvio,
  type ArquivoEnviado,
  type EnvioDeDocumentos,
  type SituacaoDaExigencia,
  detalheDoArquivoEnviado,
  regrasDoArquivo,
} from './envio-de-documentos';

const FALHA_AO_REMOVER = 'Não foi possível remover o arquivo. Tente novamente.';
const FALHA_AO_BAIXAR = 'Não foi possível baixar o arquivo. Tente novamente.';
/** O arquivo ainda em envio não tem posição: a API a dá ao registrá-lo. */
const NOME_DO_ARQUIVO_EM_ENVIO = 'Arquivo em envio';

let proximoId = 0;

/**
 * A avaliação vem depois do envio e traz o resultado da verificação, na ordem em que a API a devolve: ela
 * prevalece sobre o que o envio guardou ao confirmar, mas não conhece, enquanto não verificado, o tamanho.
 * O que o envio confirmou e a avaliação ainda não trouxe vem em seguida.
 */
function arquivosConfirmados(
  avaliados: readonly ArquivoEnviado[],
  confirmadosPeloEnvio: ReadonlyMap<string, ArquivoEnviado>,
  removidos: ReadonlySet<string>,
): ArquivoEnviado[] {
  const doServidor = new Map<string, ArquivoEnviado>();
  for (const arquivo of avaliados) {
    const confirmado = confirmadosPeloEnvio.get(arquivo.arquivoId);
    doServidor.set(arquivo.arquivoId, daAvaliacaoSobreOEnvio(arquivo, confirmado));
  }
  for (const [id, arquivo] of confirmadosPeloEnvio)
    if (!doServidor.has(id)) doServidor.set(id, arquivo);
  for (const id of removidos) doServidor.delete(id);
  return [...doServidor.values()];
}

function semId(ids: ReadonlySet<string>, id: string): Set<string> {
  const restantes = new Set(ids);
  restantes.delete(id);
  return restantes;
}

function novoArquivoEmEnvio(id: string, arquivo: File): ArquivoEmEnvio {
  return {
    id,
    nome: NOME_DO_ARQUIVO_EM_ENVIO,
    tamanhoBytes: arquivo.size,
    fase: 'iniciando',
    progresso: 0,
  };
}

/**
 * O envio dos arquivos de UMA exigência de documento: escolher por teclado ou arrastando, acompanhar o
 * progresso, ver o que foi enviado e remover enquanto a inscrição é rascunho. A tela não fala com a API:
 * o `EnvioDeDocumentos` de quem hospeda faz o caminho até o armazenamento.
 */
@Component({
  selector: 'insc-envio-do-documento',
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
          <ui-tag [variant]="situacao.variante">
            {{ situacao.rotulo }}
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
        [disabled]="!podeEnviar()"
        [acceptedFileTypes]="regras().extensoes"
        [allowedMimeTypes]="regras().tiposDeMidia"
        [acceptLabel]="regras().rotulosDosFormatos.join(', ')"
        [maxSizeMb]="regras().tamanhoMaximoMb"
        [descritoPor]="quantidadeMinima() > 1 ? idDaDica : null"
        [permitirBaixar]="true"
        [mensagemExterna]="falhaAoRemover() ?? falhaAoBaixar() ?? erroDoServidor()"
        (arquivosEscolhidos)="enviarTodos($event)"
        (tentarDeNovo)="tentarDeNovo($event)"
        (itemRetirado)="retirar($event)"
        (itemBaixado)="baixar($event)"
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
  /** A recusa do servidor desta exigência, por exemplo o documento obrigatório que falta. */
  readonly erroDoServidor = input<string | null>(null);
  readonly envio = input.required<EnvioDeDocumentos>();
  /** Os arquivos que a API já registrou para esta exigência, além dos que o próprio envio confirmou. */
  readonly arquivos = input<readonly ArquivoEnviado[]>([]);
  /** Se a avaliação já disse que a exigência está atendida; nula, nada se afirma. */
  readonly situacao = input<SituacaoDaExigencia | null>(null);
  /** Enviar vale enquanto a inscrição não está sendo enviada, inclusive na correção de uma já enviada. */
  readonly podeEnviar = input(true);
  /** Remover só vale enquanto a inscrição é rascunho: depois do envio o arquivo é retido. */
  readonly podeRemover = input(true);

  protected readonly regras = computed(() =>
    regrasDoArquivo(this.formatos(), this.tamanhoMaximoBytes()),
  );

  /** Os arquivos em andamento ou com falha, que a API ainda não registrou. */
  private readonly emAndamento = signal<readonly ArquivoEmEnvio[]>([]);
  /** Os arquivos já removidos: a avaliação que os trazia só muda quando é refeita. */
  private readonly removidos = signal<ReadonlySet<string>>(new Set());
  /** Os arquivos cuja remoção está em curso: um segundo clique não dispara outra. */
  private readonly removendo = signal<ReadonlySet<string>>(new Set());
  protected readonly falhaAoRemover = signal<string | null>(null);
  protected readonly falhaAoBaixar = signal<string | null>(null);
  /** Os arquivos cujo acesso está sendo pedido: um segundo clique não dispara outro download. */
  private readonly baixando = new Set<string>();
  /** Os bytes de cada arquivo em andamento, para a nova tentativa; não é estado da tela. */
  private readonly bytes = new Map<string, File>();
  private proximoLocal = 0;

  private readonly confirmadosPeloEnvio = computed(
    () =>
      new Map(
        this.envio()
          .arquivos()
          .filter((a) => a.chave === this.alvo().chave)
          .map((a) => [a.arquivoId, a]),
      ),
  );

  protected readonly itensDaLista = computed<readonly ArquivoEmEnvio[]>(() => {
    const doServidor = arquivosConfirmados(
      this.arquivos(),
      this.confirmadosPeloEnvio(),
      this.removidos(),
    );
    const confirmados = doServidor.map((arquivo) => this.itemConfirmado(arquivo, this.removendo()));
    const locais = this.emAndamento().map((a) => ({
      ...a,
      podeTentarDeNovo: a.podeTentarDeNovo !== false && this.podeEnviar(),
    }));
    return [...confirmados, ...locais];
  });

  private itemConfirmado(arquivo: ArquivoEnviado, removendo: ReadonlySet<string>): ArquivoEmEnvio {
    return {
      id: arquivo.arquivoId,
      nome: arquivo.rotulo,
      detalhe: detalheDoArquivoEnviado(arquivo),
      ...faseDaVerificacao(arquivo),
      progresso: 100,
      podeRetirar: this.podeRemover() && !removendo.has(arquivo.arquivoId),
    };
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destruido = true));
  }

  protected enviarTodos(arquivos: readonly File[]): void {
    this.falhaAoRemover.set(null);
    this.falhaAoBaixar.set(null);
    for (const arquivo of arquivos) {
      const id = `envio-${this.proximoLocal++}`;
      this.bytes.set(id, arquivo);
      this.emAndamento.update((lista) => [...lista, novoArquivoEmEnvio(id, arquivo)]);
      void this.enviar(id);
    }
  }

  protected tentarDeNovo(id: string): void {
    if (!this.podeEnviar()) return;
    this.falhaAoRemover.set(null);
    this.falhaAoBaixar.set(null);
    void this.enviar(id);
  }

  protected async baixar(id: string): Promise<void> {
    if (this.baixando.has(id)) return;
    this.baixando.add(id);
    this.falhaAoRemover.set(null);
    this.falhaAoBaixar.set(null);
    try {
      const desfecho = await this.envio().baixar(id);
      if (!this.destruido && !desfecho.ok)
        this.falhaAoBaixar.set(desfecho.mensagem || FALHA_AO_BAIXAR);
    } catch {
      if (!this.destruido) this.falhaAoBaixar.set(FALHA_AO_BAIXAR);
    } finally {
      this.baixando.delete(id);
    }
  }

  protected async retirar(id: string): Promise<void> {
    this.falhaAoRemover.set(null);
    this.falhaAoBaixar.set(null);
    if (this.emAndamento().some((a) => a.id === id)) {
      this.retirarLocal(id);
      return;
    }
    await this.retirarConfirmado(id);
  }

  private async retirarConfirmado(id: string): Promise<void> {
    if (this.removendo().has(id)) return;
    this.removendo.update((atual) => new Set(atual).add(id));
    const desfecho = await this.envio().remover(id);
    if (this.destruido) return;
    this.removendo.update((atual) => semId(atual, id));
    if (!desfecho.ok) {
      this.falhaAoRemover.set(desfecho.mensagem || FALHA_AO_REMOVER);
      return;
    }
    this.removidos.update((atual) => new Set(atual).add(id));
  }

  private retirarLocal(id: string): void {
    this.bytes.delete(id);
    this.emAndamento.update((lista) => lista.filter((a) => a.id !== id));
  }

  private async enviar(id: string): Promise<void> {
    const arquivo = this.bytes.get(id);
    if (arquivo === undefined) return;
    this.atualizar(id, { fase: 'iniciando', progresso: 0, mensagem: null });
    const desfecho = await this.envio().enviar(this.alvo(), arquivo, (fase, progresso) =>
      this.atualizar(id, { fase, progresso }),
    );
    if (!this.bytes.has(id)) {
      if (desfecho.ok) await this.descartar(desfecho.arquivo.arquivoId);
      return;
    }
    if (this.destruido) return;
    if (!desfecho.ok) this.registrarFalha(id, desfecho);
    else this.retirarLocal(id);
  }

  private registrarFalha(id: string, falha: { mensagem: string; podeTentarDeNovo: boolean }): void {
    this.atualizar(id, {
      fase: 'erro',
      mensagem: falha.mensagem,
      podeTentarDeNovo: falha.podeTentarDeNovo,
    });
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

/** O arquivo da avaliação, completado com o tamanho que o envio desta sessão já conhecia. */
function daAvaliacaoSobreOEnvio(
  daAvaliacao: ArquivoEnviado,
  doEnvio: ArquivoEnviado | undefined,
): ArquivoEnviado {
  if (doEnvio === undefined) return daAvaliacao;
  return {
    ...daAvaliacao,
    tamanhoBytes: daAvaliacao.tamanhoBytes ?? doEnvio.tamanhoBytes,
  };
}

/** A fase e o texto com que a lista mostra a situação da verificação do arquivo. */
function faseDaVerificacao(
  arquivo: ArquivoEnviado,
): Pick<ArquivoEmEnvio, 'fase' | 'mensagem' | 'podeTentarDeNovo'> {
  switch (arquivo.situacao) {
    case 'VERIFICADO':
      return { fase: 'confirmado' };
    case 'EM_VERIFICACAO':
      return { fase: 'verificando', mensagem: arquivo.mensagem };
    case 'PENDENTE':
      return { fase: 'iniciando' };
    case 'RECUSADO':
    case 'REENVIO_NECESSARIO':
      return { fase: 'erro', mensagem: arquivo.mensagem, podeTentarDeNovo: false };
  }
}
