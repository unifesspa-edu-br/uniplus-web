import type { Signal } from '@angular/core';

import type { FaseDoArquivo } from '../file-upload/file-upload';
import type { DocumentoExigido } from '../lista-de-documentos/lista-de-documentos';

/**
 * O envio de documento pelo candidato, visto pela tela: ela escolhe o arquivo e mostra o andamento; quem
 * hospeda sabe falar com a API e com o armazenamento. Sem um `EnvioDeDocumentos`, o passo de documentos só
 * lista o que é exigido, como na simulação do administrador.
 */

/** A exigência a que o arquivo atende e, quando ela se repete por integrante, a ocorrência. */
export interface AlvoDoEnvio {
  /** Identifica o alvo entre as exigências da tela: a exigência e a ocorrência. */
  readonly chave: string;
  readonly exigenciaId: string;
  readonly ocorrenciaId: string | null;
  /** O nome a anunciar: o documento e, quando há, o integrante. */
  readonly nome: string;
}

/** Um arquivo que a API já registrou como enviado. */
export interface ArquivoEnviado {
  readonly arquivoId: string;
  /** A chave do alvo (`AlvoDoEnvio.chave`) a que o arquivo pertence. */
  readonly chave: string;
  /** O nome que o candidato deu ao arquivo; a API não o guarda, então falta nos arquivos relidos. */
  readonly nome?: string | null;
  readonly tipoDeMidia: string;
  readonly tamanhoBytes: number;
}

export type DesfechoDoEnvio =
  | { readonly ok: true; readonly arquivo: ArquivoEnviado }
  /** `podeTentarDeNovo` é falso quando repetir o mesmo arquivo não muda a resposta. */
  | { readonly ok: false; readonly mensagem: string; readonly podeTentarDeNovo: boolean };

export type DesfechoDaRemocao =
  | { readonly ok: true }
  | { readonly ok: false; readonly mensagem: string };

/** O que o passo de documentos pede a quem hospeda para enviar e remover arquivos. */
export interface EnvioDeDocumentos {
  /**
   * Os arquivos que este envio confirmou e ainda estão de pé. Ficam com quem hospeda, e não na tela do
   * passo: trocar de passo e voltar não pode perder o que já foi enviado nem o envio que terminou depois.
   */
  readonly arquivos: Signal<readonly ArquivoEnviado[]>;
  /**
   * Leva o arquivo até a confirmação, informando a fase e o progresso. Chamado de novo com o mesmo
   * `File` depois de uma falha, retoma do ponto em que parou.
   */
  enviar(
    alvo: AlvoDoEnvio,
    arquivo: File,
    aoAndar: (fase: FaseDoArquivo, progresso: number) => void,
  ): Promise<DesfechoDoEnvio>;
  /** Remove um arquivo enviado, enquanto a inscrição é rascunho. */
  remover(arquivoId: string): Promise<DesfechoDaRemocao>;
}

/** Se a exigência está atendida pelos arquivos enviados; vem da avaliação da API. */
export type SituacaoDaExigencia = 'SATISFEITA' | 'PENDENTE';

const BYTES_POR_MB = 1024 * 1024;

interface Formato {
  readonly rotulo: string;
  readonly extensoes: readonly string[];
  readonly tiposDeMidia: readonly string[];
}

const PDF: Formato = { rotulo: 'PDF', extensoes: ['.pdf'], tiposDeMidia: ['application/pdf'] };
const JPG: Formato = {
  rotulo: 'JPG',
  extensoes: ['.jpg', '.jpeg'],
  tiposDeMidia: ['image/jpeg', 'image/jpg'],
};
const PNG: Formato = { rotulo: 'PNG', extensoes: ['.png'], tiposDeMidia: ['image/png'] };

const FORMATOS: Readonly<Record<string, Formato>> = {
  PDF,
  JPEG: JPG,
  JPG,
  PNG,
};

/** O que o armazenamento da inscrição aceita, qualquer que seja a exigência. */
const FORMATOS_DO_ARMAZENAMENTO: readonly Formato[] = [PDF, JPG, PNG];

/** O que o seletor de arquivos aplica a uma exigência, a partir dos formatos e do teto dela. */
export interface RegrasDoArquivo {
  readonly extensoes: string;
  readonly tiposDeMidia: readonly string[];
  readonly rotuloDosFormatos: string;
  readonly tamanhoMaximoMb: number;
}

export function regrasDoArquivo(
  formatos: DocumentoExigido['formatos'],
  tamanhoMaximoBytes: number,
): RegrasDoArquivo {
  const lista = formatos.lista ?? [];
  const declarados = lista.flatMap((nome) => FORMATOS[nome.trim().toUpperCase()] ?? []);
  const aceitos =
    formatos.qualquer || declarados.length === 0
      ? FORMATOS_DO_ARMAZENAMENTO
      : [...new Set(declarados)];
  return {
    extensoes: aceitos.flatMap((f) => f.extensoes).join(','),
    tiposDeMidia: aceitos.flatMap((f) => f.tiposDeMidia),
    rotuloDosFormatos: aceitos.map((f) => f.rotulo).join(', '),
    tamanhoMaximoMb: tamanhoMaximoBytes / BYTES_POR_MB,
  };
}

/** O tipo de mídia que o envio declara, pela extensão; nulo quando o formato não serve à inscrição. */
export function tipoDeMidiaDoArquivo(nomeDoArquivo: string): string | null {
  const nome = nomeDoArquivo.toLowerCase();
  const formato = FORMATOS_DO_ARMAZENAMENTO.find((f) => f.extensoes.some((e) => nome.endsWith(e)));
  return formato?.tiposDeMidia[0] ?? null;
}
