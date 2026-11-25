import {
  ofertasEmOrdem,
  type ArquivoAdministrativoDto,
  type InscricaoAdministrativaDto,
  type OfertaExibida,
} from '@uniplus/shared-data/selecao';
import { detalheDoArquivoEnviado } from '@uniplus/shared-inscricao/formulario';
import { formatarDataBr } from '@uniplus/shared-utils';

/** O que a lista de um arquivo mostra e o nome acessível do "Abrir" dele. */
export interface ArquivoExibido {
  readonly id: string;
  readonly nome: string;
  readonly situacao: ArquivoAdministrativoDto['situacao'];
  readonly detalhe: string;
  readonly nomeDoAbrir: string;
}

/** Os campos do painel de identificação; `null` é o que a API não devolveu. */
export interface IdentificacaoExibida {
  readonly numero: string | null;
  readonly situacao: InscricaoAdministrativaDto['situacao'] | null;
  /** Vazia quando a API omitiu as ofertas; a tela então não mostra o rótulo. */
  readonly ofertas: readonly OfertaExibida[];
  readonly enviadaEm: string | null;
  readonly canceladaEm: string | null;
  readonly motivoDoCancelamento: string | null;
}

/** A ocorrência de grupo repetível que o detalhe devolveu: o rótulo do grupo e a posição nele. */
interface OcorrenciaConhecida {
  readonly grupo: string;
  readonly ordem: number;
}

/** Onde o arquivo está entre os da mesma exigência e da mesma ocorrência de grupo. */
interface PosicaoDoArquivo {
  readonly posicao: number;
  readonly total: number;
  /** A ocorrência, só quando o detalhe a trouxe; ocorrência sem item visível é omitida pela API. */
  readonly ocorrencia: OcorrenciaConhecida | null;
}

/**
 * O que o painel de identificação mostra, cada campo só quando a API o devolveu; `null` quando
 * nenhum veio e o painel não existe.
 */
export function identificacaoExibida(
  inscricao: InscricaoAdministrativaDto | null,
): IdentificacaoExibida | null {
  if (inscricao === null) return null;
  const campos: IdentificacaoExibida = {
    numero: inscricao.numeroInscricao || null,
    situacao: inscricao.situacao ?? null,
    ofertas: ofertasEmOrdem(inscricao.ofertas),
    enviadaEm: inscricao.submetidaEm ?? null,
    canceladaEm: inscricao.canceladaEm ?? null,
    motivoDoCancelamento: inscricao.motivoDoCancelamento || null,
  };
  return temIdentificacao(campos) ? campos : null;
}

function temIdentificacao(campos: IdentificacaoExibida): boolean {
  return Object.values(campos).some((valor) =>
    Array.isArray(valor) ? valor.length > 0 : valor !== null,
  );
}

function arquivoExibido(
  arquivo: ArquivoAdministrativoDto,
  lugar: PosicaoDoArquivo,
): ArquivoExibido {
  const enviadoEm = formatarDataBr(arquivo.confirmadoEm, 'datetime');
  const documento = nomeDoDocumento(arquivo, lugar);
  return {
    id: arquivo.arquivoId,
    nome: documento,
    situacao: arquivo.situacao,
    detalhe: detalheDoArquivoEnviado(arquivo),
    nomeDoAbrir: nomeParaAbrirDocumento(documento, lugar, enviadoEm),
  };
}

function nomeDoDocumento(arquivo: ArquivoAdministrativoDto, lugar: PosicaoDoArquivo): string {
  // O grupo junto da ordem evita o mesmo nome para a ocorrência 1 de dois grupos diferentes.
  return lugar.ocorrencia === null
    ? arquivo.nomeDoDocumento
    : `${arquivo.nomeDoDocumento} (${lugar.ocorrencia.grupo}, ocorrência ${lugar.ocorrencia.ordem})`;
}

function nomeParaAbrirDocumento(
  documento: string,
  lugar: PosicaoDoArquivo,
  enviadoEm: string,
): string {
  // O mesmo documento pode ter vários arquivos: a posição entre eles distingue o nome mesmo quando
  // a data é igual ou inválida.
  return [
    `Abrir ${documento}`,
    lugar.total > 1 ? `arquivo ${lugar.posicao} de ${lugar.total}` : null,
    enviadoEm === '' ? null : `enviado em ${enviadoEm}`,
  ]
    .filter((parte) => parte !== null)
    .join(', ');
}

/** Cada ocorrência de grupo repetível que o detalhe devolveu, pelo id da ocorrência. */
function ocorrenciasConhecidas(
  inscricao: InscricaoAdministrativaDto,
): ReadonlyMap<string, OcorrenciaConhecida> {
  const conhecidas = new Map<string, OcorrenciaConhecida>();
  for (const secao of inscricao.secoes) {
    for (const grupo of secao.grupos) {
      grupo.ocorrencias.forEach((o, indice) =>
        conhecidas.set(o.id, { grupo: grupo.rotulo, ordem: indice + 1 }),
      );
    }
  }
  return conhecidas;
}

/**
 * Os arquivos na ordem da API, cada um com a posição entre os da mesma exigência e ocorrência. A
 * ocorrência só é nomeada quando o detalhe a trouxe. A que a API omitiu, por não ter item visível,
 * não ganha número, e todos os arquivos de ocorrências omitidas da mesma exigência contam juntos:
 * "arquivo 1 de 2" e "arquivo 2 de 2" os distinguem mesmo com a mesma data.
 */
export function arquivosExibidos(inscricao: InscricaoAdministrativaDto | null): ArquivoExibido[] {
  const arquivos = inscricao?.arquivos ?? [];
  const conhecidas =
    inscricao === null ? new Map<string, OcorrenciaConhecida>() : ocorrenciasConhecidas(inscricao);
  return exibirArquivosPorOcorrencia(arquivos, conhecidas);
}

function exibirArquivosPorOcorrencia(
  arquivos: readonly ArquivoAdministrativoDto[],
  conhecidas: ReadonlyMap<string, OcorrenciaConhecida>,
): ArquivoExibido[] {
  const chave = (arquivo: ArquivoAdministrativoDto): string =>
    chaveDaOcorrencia(arquivo, conhecidas);
  const total = contarArquivosPorOcorrencia(arquivos, chave);
  const visto = new Map<string, number>();
  return arquivos.map((a) => {
    const posicao = (visto.get(chave(a)) ?? 0) + 1;
    visto.set(chave(a), posicao);
    const ocorrencia = a.ocorrenciaId == null ? null : (conhecidas.get(a.ocorrenciaId) ?? null);
    return arquivoExibido(a, { posicao, total: total.get(chave(a)) ?? 1, ocorrencia });
  });
}

function chaveDaOcorrencia(
  arquivo: ArquivoAdministrativoDto,
  conhecidas: ReadonlyMap<string, OcorrenciaConhecida>,
): string {
  if (arquivo.ocorrenciaId == null) return `${arquivo.exigenciaId}|`;
  return conhecidas.has(arquivo.ocorrenciaId)
    ? `${arquivo.exigenciaId}|${arquivo.ocorrenciaId}`
    : `${arquivo.exigenciaId}|omitida`;
}

function contarArquivosPorOcorrencia(
  arquivos: readonly ArquivoAdministrativoDto[],
  chave: (arquivo: ArquivoAdministrativoDto) => string,
): Map<string, number> {
  const total = new Map<string, number>();
  for (const arquivo of arquivos) total.set(chave(arquivo), (total.get(chave(arquivo)) ?? 0) + 1);
  return total;
}
