import { SECAO_DADOS_BASICOS } from './constantes';
import {
  ConteudoDoFormulario,
  GrupoDoFormulario,
  ItemDoFormulario,
  LimiteDeDataNoWire,
  NumeroDigitado,
} from './tipos';

/** O conteúdo sem a seção dos dados básicos: a API a repõe, e o envio que a altera é recusado. */
export function semDadosBasicos(conteudo: ConteudoDoFormulario): ConteudoDoFormulario {
  return {
    ...conteudo,
    paginas: (conteudo.paginas ?? []).filter((pagina) => pagina.codigo !== SECAO_DADOS_BASICOS),
    itens: (conteudo.itens ?? []).filter((item) => item.paginaCodigo !== SECAO_DADOS_BASICOS),
  };
}

class NaoENumero extends Error {}

function comoNumero(valor: NumeroDigitado): number;
function comoNumero(valor: NumeroDigitado | null): number | null;
function comoNumero(valor: NumeroDigitado | null | undefined): number | null | undefined;
function comoNumero(valor: NumeroDigitado | null | undefined): number | null | undefined {
  if (numeroDigitadoInvalido(valor)) throw new NaoENumero();
  return valor === null || valor === undefined ? valor : Number(valor);
}

/** O que foi digitado e não é número: o texto vazio, ou o que não se converte. Ausente não é inválido. */
export function numeroDigitadoInvalido(valor: NumeroDigitado | null | undefined): boolean {
  return typeof valor === 'string' && (valor.trim() === '' || !Number.isFinite(Number(valor)));
}

function limiteParaEnvio(
  limite: LimiteDeDataNoWire | null | undefined,
): LimiteDeDataNoWire<number> | null | undefined {
  return limite === null || limite === undefined
    ? limite
    : { ...limite, anos: comoNumero(limite.anos), dias: comoNumero(limite.dias) };
}

function itemParaEnvio(item: ItemDoFormulario): ItemDoFormulario<number> {
  return {
    ...item,
    regras: {
      ...item.regras,
      restricoes: item.regras.restricoes?.map((restricao) => ({
        ...restricao,
        minimo: comoNumero(restricao.minimo),
        maximo: comoNumero(restricao.maximo),
        dataMinima: limiteParaEnvio(restricao.dataMinima),
        dataMaxima: limiteParaEnvio(restricao.dataMaxima),
      })),
    },
  };
}

function grupoParaEnvio(grupo: GrupoDoFormulario): GrupoDoFormulario<number> {
  return {
    ...grupo,
    ocorrencias: {
      ...grupo.ocorrencias,
      minimo: comoNumero(grupo.ocorrencias.minimo),
      maximo: comoNumero(grupo.ocorrencias.maximo),
    },
    subitens: grupo.subitens.map(itemParaEnvio),
  };
}

/**
 * O conteúdo com todo número como número, para a gravação. O texto digitado que não é número (limites,
 * deslocamentos, mínimo e máximo do grupo) não se converte: devolve `null`, em vez de mandar número em
 * texto à API.
 */
export function conteudoParaEnvio(
  conteudo: ConteudoDoFormulario,
): ConteudoDoFormulario<number> | null {
  try {
    return {
      ...conteudo,
      itens: conteudo.itens?.map(itemParaEnvio) ?? null,
      grupos: conteudo.grupos?.map(grupoParaEnvio),
    };
  } catch (erro) {
    if (erro instanceof NaoENumero) return null;
    throw erro;
  }
}
