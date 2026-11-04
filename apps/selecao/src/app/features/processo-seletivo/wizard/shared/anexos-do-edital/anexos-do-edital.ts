import type { AnexoDoEditalRequest } from '@uniplus/shared-data/selecao';

import type { AnexoDoEdital } from '../../processo-seletivo.models';

/** Quantos anexos um edital aceita. */
export const LIMITE_DE_ANEXOS = 20;

/** O teto de cada anexo no domínio: 20 MB. */
export const TAMANHO_MAXIMO_DO_ANEXO_MB = 20;

/** O tamanho máximo do nome no download, com a extensão. */
const TAMANHO_MAXIMO_DO_NOME = 120;

/** O que o nome não pode ter, além dos caracteres de controle. */
const CARACTERES_PROIBIDOS_NO_NOME = '/\\<>:"|?*;';

/** O formato de cada extensão aceita e o tipo de mídia que o envio declara para ela. */
const TIPO_DE_MIDIA_POR_EXTENSAO: ReadonlyMap<string, string> = new Map([
  ['pdf', 'application/pdf'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['odt', 'application/vnd.oasis.opendocument.text'],
]);

/** As extensões que o campo de arquivo aceita, no formato do atributo `accept`. */
export const EXTENSOES_DO_ANEXO = [...TIPO_DE_MIDIA_POR_EXTENSAO.keys()].map((e) => `.${e}`).join(',');

/** A extensão do arquivo em minúsculas e sem o ponto; vazia quando não há. */
export function extensaoDoArquivo(nomeArquivo: string): string {
  const ponto = nomeArquivo.lastIndexOf('.');
  return ponto < 0 ? '' : nomeArquivo.slice(ponto + 1).toLowerCase();
}

/** O tipo de mídia que o envio declara; nulo quando a extensão não é de um formato aceito. */
export function tipoDeMidiaDoAnexo(nomeArquivo: string): string | null {
  return TIPO_DE_MIDIA_POR_EXTENSAO.get(extensaoDoArquivo(nomeArquivo)) ?? null;
}

/** O nome com que o anexo começa: o do arquivo, sem a extensão, que o servidor acrescenta. */
export function nomeInicialDoAnexo(nomeArquivo: string): string {
  const ponto = nomeArquivo.lastIndexOf('.');
  return ponto <= 0 ? nomeArquivo : nomeArquivo.slice(0, ponto);
}

/**
 * O nome do anexo como o servidor o normaliza: aparado, em NFC e sem a extensão do arquivo, que
 * ele acrescenta uma só vez. Vazio quando só sobrava a extensão.
 */
function nomeSemExtensao(nome: string, nomeArquivo: string): string {
  const extensao = extensaoDoArquivo(nomeArquivo);
  const sufixo = extensao === '' ? '' : `.${extensao}`;
  const limpo = nome.trim().normalize('NFC');
  return sufixo !== '' && limpo.toLowerCase().endsWith(sufixo)
    ? limpo.slice(0, -sufixo.length).trimEnd()
    : limpo;
}

/** O nome com que o anexo é baixado: o normalizado, com a extensão do arquivo uma só vez. */
export function nomeNoDownload(nome: string, nomeArquivo: string): string {
  const extensao = extensaoDoArquivo(nomeArquivo);
  return `${nomeSemExtensao(nome, nomeArquivo)}${extensao === '' ? '' : `.${extensao}`}`;
}

/**
 * Por que o servidor recusaria o nome, ou `null` quando ele serve. Espelha a regra do download:
 * obrigatório, sem separador de caminho nem caractere de controle, e com no máximo
 * {@link TAMANHO_MAXIMO_DO_NOME} caracteres contando a extensão.
 */
export function recusaDoNomeDoAnexo(nome: string, nomeArquivo: string): string | null {
  const limpo = nomeSemExtensao(nome, nomeArquivo);
  if (limpo === '') return 'Informe o nome do anexo.';
  if ([...limpo].some(proibido)) {
    return `O nome do anexo não pode ter caractere de controle nem nenhum destes: ${[...CARACTERES_PROIBIDOS_NO_NOME].join(' ')}`;
  }
  if (nomeNoDownload(nome, nomeArquivo).length > TAMANHO_MAXIMO_DO_NOME) {
    return `O nome do anexo passa de ${TAMANHO_MAXIMO_DO_NOME} caracteres com a extensão.`;
  }
  return null;
}

function proibido(caractere: string): boolean {
  const codigo = caractere.codePointAt(0) ?? 0;
  const deControle = codigo < 0x20 || (codigo >= 0x7f && codigo <= 0x9f);
  return deControle || CARACTERES_PROIBIDOS_NO_NOME.includes(caractere);
}

/** O anexo que o servidor já selou: só ele pode ser publicado. */
export function anexoConfirmado(anexo: AnexoDoEdital): boolean {
  return anexo.fase === 'confirmado' && anexo.documentoAPublicarId !== undefined;
}

/** Os anexos a publicar, no formato do pedido. */
export function comoPedidoDeAnexos(
  anexos: readonly AnexoDoEdital[],
): readonly AnexoDoEditalRequest[] {
  return anexos.filter(anexoConfirmado).map((anexo) => ({
    documentoId: anexo.documentoAPublicarId as string,
    nome: anexo.nome.trim(),
  }));
}

/**
 * O que impede de publicar por causa dos anexos. Cada recusa é a que o servidor faria, dita antes
 * de o operador confirmar o único clique do wizard que não se desfaz.
 */
export function mensagensDosAnexos(anexos: readonly AnexoDoEdital[]): string[] {
  const mensagens: string[] = [];

  if (anexos.length > LIMITE_DE_ANEXOS) {
    mensagens.push(`O edital aceita no máximo ${LIMITE_DE_ANEXOS} anexos.`);
  }
  if (anexos.some((anexo) => !anexoConfirmado(anexo))) {
    mensagens.push(
      'Há anexo do edital que não foi enviado por completo. Aguarde o envio, tente de novo ou retire o anexo antes de publicar.',
    );
  }
  for (const anexo of anexos.filter(anexoConfirmado)) {
    const recusa = recusaDoNomeDoAnexo(anexo.nome, anexo.nomeArquivo);
    if (recusa !== null) mensagens.push(`Anexo ${anexo.nomeArquivo}: ${recusa}`);
  }

  return mensagens;
}
