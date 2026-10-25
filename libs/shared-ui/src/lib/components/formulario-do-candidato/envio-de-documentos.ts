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

/**
 * Onde o arquivo está na verificação que a API faz depois da confirmação. Só o `verificado` conta para
 * a exigência; `recusado` e `reenvioNecessario` pedem que o candidato troque o arquivo. Espelha o enum
 * `SituacaoDoArquivoDoCandidato` do contrato, que esta lib não pode importar: o compilador acusa a
 * situação nova onde o DTO da API é atribuído a este tipo.
 */
export type SituacaoDoArquivo =
  | 'pendente'
  | 'emVerificacao'
  | 'verificado'
  | 'recusado'
  | 'reenvioNecessario';

/** Se a verificação do arquivo ainda não terminou. */
export function emVerificacao(situacao: SituacaoDoArquivo): boolean {
  return situacao === 'emVerificacao';
}

/** Um arquivo que a API já registrou como enviado. */
export interface ArquivoEnviado {
  readonly arquivoId: string;
  /** O arquivo e o verso dele compartilham a apresentação, que é o que conta para a exigência. */
  readonly apresentacaoId: string;
  readonly situacao: SituacaoDoArquivo;
  /** O que dizer ao candidato sobre a situação, como a API a devolve (UNI-REQ-0027); nulo no verificado. */
  readonly mensagem: string | null;
  /** A chave do alvo (`AlvoDoEnvio.chave`) a que o arquivo pertence. */
  readonly chave: string;
  readonly tipoDeMidia: string;
  /** Como a API chama o arquivo ("Arquivo 2"): o mesmo número do nome com que ele é baixado. */
  readonly rotulo: string;
  /** Quando a API registrou o arquivo (instante ISO), mostrado como a data do envio. */
  readonly confirmadoEm: string;
  /** Só existe no arquivo verificado. */
  readonly tamanhoBytes: number | null;
}

export type DesfechoDoEnvio =
  | { readonly ok: true; readonly arquivo: ArquivoEnviado }
  /** `podeTentarDeNovo` é falso quando repetir o mesmo arquivo não muda a resposta. */
  | { readonly ok: false; readonly mensagem: string; readonly podeTentarDeNovo: boolean };

export type DesfechoDaRemocao =
  | { readonly ok: true }
  | { readonly ok: false; readonly mensagem: string };

export type DesfechoDoDownload =
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
   * Quantas vezes o envio confirmou ou removeu um arquivo. Quem hospeda reavalia as exigências a cada
   * mudança, inclusive na remoção de um arquivo que veio da avaliação e nunca esteve em `arquivos`.
   */
  readonly mudancas: Signal<number>;
  /** Se há envio ou remoção em andamento: gravar a inscrição agora sairia com a revisão velha. */
  readonly ocupado: Signal<boolean>;
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
  /** Baixa um arquivo verificado, em qualquer situação da inscrição. */
  baixar(arquivoId: string): Promise<DesfechoDoDownload>;
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
  readonly rotulosDosFormatos: readonly string[];
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
    rotulosDosFormatos: aceitos.map((f) => f.rotulo),
    tamanhoMaximoMb: tamanhoMaximoBytes / BYTES_POR_MB,
  };
}

/** O prefixo do campo com que a API aponta a recusa de uma exigência documental. */
const PREFIXO_DO_CAMPO_DE_DOCUMENTO = 'documentos.';

/** O campo da recusa de uma exigência: `documentos.<exigenciaId>`, com `.<ocorrenciaId>` quando há. */
export function campoDaExigencia(exigenciaId: string, ocorrenciaId: string | null): string {
  return `${PREFIXO_DO_CAMPO_DE_DOCUMENTO}${exigenciaId}${ocorrenciaId === null ? '' : `.${ocorrenciaId}`}`;
}

/** A chave da exigência (e da ocorrência) que o campo da recusa aponta, a mesma de `chaveDaExigencia`. */
export function chaveDoCampoDeDocumento(campo: string): string {
  const [exigenciaId, ocorrenciaId = ''] = campo
    .slice(PREFIXO_DO_CAMPO_DE_DOCUMENTO.length)
    .split('.');
  return `${exigenciaId}:${ocorrenciaId}`;
}

/** Se o campo da recusa é de uma exigência documental, e não de uma resposta do formulário. */
export function ehCampoDeDocumento(campo: string): boolean {
  return campo.startsWith(PREFIXO_DO_CAMPO_DE_DOCUMENTO);
}

/**
 * Os formatos que a avaliação diz aceitar para a exigência, com o nome que a zona de envio usa. É o
 * que a linha da lista também mostra: as duas dizem o mesmo, em vez de a lista dizer "qualquer
 * formato" enquanto o envio recusa o que não é PDF, JPG ou PNG.
 */
export function formatosDaExigencia(formatosAceitos: readonly string[]): {
  readonly qualquer: false;
  readonly lista: readonly string[];
} {
  const { rotulosDosFormatos } = regrasDoArquivo({ qualquer: false, lista: formatosAceitos }, 0);
  return { qualquer: false, lista: rotulosDosFormatos };
}

/** O rótulo do formato de um tipo de mídia ("JPG" para image/jpeg), o mesmo que a zona de envio mostra; nulo se não é um formato da inscrição. */
export function rotuloDoFormato(tipoDeMidia: string): string | null {
  return FORMATOS_DO_ARMAZENAMENTO.find((f) => f.tiposDeMidia.includes(tipoDeMidia))?.rotulo ?? null;
}

/** O tipo de mídia que o envio declara, pela extensão; nulo quando o formato não serve à inscrição. */
export function tipoDeMidiaDoArquivo(nomeDoArquivo: string): string | null {
  const nome = nomeDoArquivo.toLowerCase();
  const formato = FORMATOS_DO_ARMAZENAMENTO.find((f) => f.extensoes.some((e) => nome.endsWith(e)));
  return formato?.tiposDeMidia[0] ?? null;
}
