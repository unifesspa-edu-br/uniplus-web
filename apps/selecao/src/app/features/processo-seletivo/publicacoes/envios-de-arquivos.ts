import { computed, signal } from '@angular/core';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import type { FinalidadeDoDocumento } from '@uniplus/shared-data/selecao';
import type { ArquivoEmEnvio } from '@uniplus/shared-ui/components';

import type { EnvioDoAnexo } from '../steps/shared/anexos-do-edital/envio-do-anexo.service';
import type { AnexoConfirmado } from './pedido-do-ato';
import { EnvioDeArquivo, soFaltaConfirmar, type EstadoDoEnvio } from '../steps/shared/envio-de-arquivo';

/** Um arquivo da lista do formulário: o escolhido, onde o envio parou e o nome do download. */
export interface ArquivoDoAto extends EstadoDoEnvio {
  readonly id: string;
  /** O arquivo como a pessoa o escolheu; identifica o item na lista de envio. */
  readonly nomeArquivo: string;
  /** O nome com que a pessoa recebe o arquivo no download; só os anexos o editam. */
  readonly nome: string;
}

export interface DependenciasDosEnvios {
  readonly finalidade: FinalidadeDoDocumento;
  /** O processo em que os arquivos são enviados; `null` enquanto não houver um. */
  readonly processoId: () => string | null;
  readonly abrirEnvio: () => EnvioDoAnexo;
  /** O tipo de mídia que o envio declara para o arquivo; `null` quando o formato não serve. */
  readonly tipoDeMidiaDe: (nomeArquivo: string) => string | null;
  readonly recusaDoFormato: string;
  readonly explicar: (problema: ProblemDetails) => string;
  /** O nome com que o arquivo começa na lista, antes de a pessoa editá-lo. */
  readonly nomeInicial: (nomeArquivo: string) => string;
}

/**
 * Uma lista de arquivos em envio ao storage: o documento principal do ato, ou os anexos dele.
 *
 * Os envios correm um de cada vez, e um que falha não impede os seguintes. Os bytes e a URL
 * pré-assinada ficam em memória; no estado vai só o que a tela exibe. Esvaziar a lista invalida os
 * envios em curso, para que a resposta tardia de um não escreva numa lista que já é outra.
 */
export class EnviosDeArquivos {
  private readonly memoria = new Map<string, EnvioDeArquivo>();
  /** A fila única dos envios: uma nova escolha entra no fim, atrás do que já corre. */
  private fila: Promise<void> = Promise.resolve();
  private geracao = 0;

  readonly arquivos = signal<readonly ArquivoDoAto[]>([]);
  /** Os arquivos que o servidor já selou: só eles podem compor o ato. */
  readonly confirmados = computed<readonly AnexoConfirmado[]>(() =>
    this.arquivos().flatMap((arquivo) =>
      arquivo.fase === 'confirmado' && arquivo.documentoAPublicarId !== undefined
        ? [{ documentoAPublicarId: arquivo.documentoAPublicarId, nome: arquivo.nome }]
        : [],
    ),
  );
  /** Quantos arquivos da lista ainda não foram selados. */
  readonly naoConfirmados = computed(() => this.arquivos().length - this.confirmados().length);

  /** Os arquivos na forma que a lista do `ui-file-upload` exibe. */
  readonly itens = computed<readonly ArquivoEmEnvio[]>(() =>
    this.arquivos().map((arquivo) => ({
      id: arquivo.id,
      nome: arquivo.nomeArquivo,
      fase: arquivo.fase,
      progresso: arquivo.progress,
      mensagem: arquivo.mensagemErro,
      podeTentarDeNovo: this.podeRetomar(arquivo),
      podeRetirar: !estaEmAndamento(arquivo),
    })),
  );

  constructor(private readonly dependencias: DependenciasDosEnvios) {}

  /** O ui-file-upload entrega só arquivo aprovado em formato e tamanho. */
  escolher(arquivos: readonly File[]): void {
    const processoId = this.dependencias.processoId();
    if (processoId === null) return;

    const novos = arquivos.map((arquivo) => this.registrar(arquivo));
    // A lista cresce de forma síncrona: o limite do ui-file-upload conta o que já está nela.
    this.arquivos.update((atuais) => [...atuais, ...novos]);
    const ids = novos.map((novo) => novo.id);
    this.fila = this.fila.then(async () => {
      for (const id of ids) await this.executar(processoId, id);
    });
  }

  /**
   * Retoma da fase que falhou, sem repetir o que já concluiu. A nova tentativa entra no fim da
   * mesma fila das escolhas: com outro arquivo enviando, as duas requisições correriam juntas.
   */
  async retomar(id: string): Promise<void> {
    const processoId = this.dependencias.processoId();
    const arquivo = this.arquivoDe(id);
    if (processoId === null || arquivo === undefined || !this.podeRetomar(arquivo)) return;

    this.fila = this.fila.then(() => this.executar(processoId, id));
    await this.fila;
  }

  /** Só sai da lista o que não está em envio; o documento já confirmado fica no servidor sem uso. */
  retirar(id: string): void {
    const arquivo = this.arquivoDe(id);
    if (arquivo === undefined || estaEmAndamento(arquivo)) return;

    this.memoria.delete(id);
    this.arquivos.update((atuais) => atuais.filter((item) => item.id !== id));
  }

  renomear(id: string, nome: string): void {
    this.alterar(id, (arquivo) => ({ ...arquivo, nome }));
  }

  /**
   * Esvazia a lista e descarta os envios em curso. A fila recomeça: o envio descartado que ainda
   * espera a rede não pode segurar os arquivos escolhidos depois, e a resposta dele já não escreve
   * na lista nova.
   */
  descartar(): void {
    this.geracao += 1;
    this.memoria.clear();
    this.arquivos.set([]);
    this.fila = Promise.resolve();
  }

  /**
   * Repetir pede o processo e algo a repetir: o arquivo na memória, ou o PUT já feito (só falta
   * confirmar, o que dispensa os bytes).
   */
  private podeRetomar(arquivo: ArquivoDoAto): boolean {
    return (
      arquivo.fase === 'erro' &&
      this.dependencias.processoId() !== null &&
      (this.memoria.has(arquivo.id) || soFaltaConfirmar(arquivo))
    );
  }

  private registrar(arquivo: File): ArquivoDoAto {
    const item: ArquivoDoAto = {
      id: crypto.randomUUID(),
      nomeArquivo: arquivo.name,
      nome: this.dependencias.nomeInicial(arquivo.name),
      progress: 0,
      fase: 'iniciando',
    };
    const geracao = this.geracao;
    this.memoria.set(
      item.id,
      new EnvioDeArquivo({
        envio: this.dependencias.abrirEnvio(),
        arquivo,
        finalidade: this.dependencias.finalidade,
        tipoDeMidia: this.dependencias.tipoDeMidiaDe(arquivo.name),
        recusaDoFormato: this.dependencias.recusaDoFormato,
        explicar: this.dependencias.explicar,
        vale: () => geracao === this.geracao,
      }),
    );
    return item;
  }

  private async executar(processoId: string, id: string): Promise<void> {
    const envio = this.memoria.get(id);
    if (envio === undefined) return;

    await envio.executar(processoId, {
      estado: () => this.arquivoDe(id),
      atualizar: (alteracao) => this.alterar(id, (arquivo) => ({ ...arquivo, ...alteracao })),
    });
    if (envio.foiConfirmado) this.memoria.delete(id);
  }

  private arquivoDe(id: string): ArquivoDoAto | undefined {
    return this.arquivos().find((arquivo) => arquivo.id === id);
  }

  private alterar(id: string, alterar: (arquivo: ArquivoDoAto) => ArquivoDoAto): void {
    this.arquivos.update((atuais) => atuais.map((item) => (item.id === id ? alterar(item) : item)));
  }
}

function estaEmAndamento(arquivo: Pick<ArquivoDoAto, 'fase'>): boolean {
  return arquivo.fase === 'iniciando' || arquivo.fase === 'enviando' || arquivo.fase === 'confirmando';
}
