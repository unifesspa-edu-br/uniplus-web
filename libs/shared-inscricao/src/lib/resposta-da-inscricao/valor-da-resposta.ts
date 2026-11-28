import { ehSituacaoConhecida } from '@uniplus/shared-inscricao/situacao-da-inscricao';
import type { UiValorEmConsulta } from '@uniplus/shared-ui/components';
import { formatarCep, formatarDataBr } from '@uniplus/shared-utils';

import { formatarDecimalExato, formatarMoeda } from './decimal-exato';

/**
 * O valor de uma resposta pronto para a tela: o endereço sai em linhas; o resto, no valor em
 * consulta, cuja apresentação (Sim/Não, lista, "Não informado") é do `ui-valor-apresentado`.
 */
export type ValorExibido =
  | { readonly linhas: readonly string[] }
  | { readonly situacao: string }
  | { readonly valor: UiValorEmConsulta };

const SEM_VALOR: ValorExibido = { valor: null };

function ehRegistro(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

function opcaoRotulo(valor: unknown): string | null {
  return ehRegistro(valor) ? texto(valor['rotulo']) : null;
}

function viaComComplemento(valor: Readonly<Record<string, unknown>>): string | null {
  const via = [texto(valor['logradouro']), texto(valor['numero'])]
    .filter((parte) => parte !== null)
    .join(', ');
  const complemento = texto(valor['complemento']);
  return complemento === null || via === '' ? via || complemento : `${via} — ${complemento}`;
}

function endereco(valor: Readonly<Record<string, unknown>>): ValorExibido {
  const cidade = [texto(valor['municipio']), texto(valor['uf'])]
    .filter((parte) => parte !== null)
    .join('/');
  const cep = texto(valor['cep']);
  const linhas = [
    viaComComplemento(valor),
    texto(valor['bairro']),
    cidade,
    cep === null ? null : `CEP ${formatarCep(cep)}`,
  ].filter((linha): linha is string => linha !== null && linha !== '');
  return linhas.length === 0 ? SEM_VALOR : { linhas };
}

type Leitor = (valor: unknown) => ValorExibido | undefined;

const LEITORES_POR_TIPO: Readonly<Record<string, Leitor>> = {
  SIM_OU_NAO: (valor) => (typeof valor === 'boolean' ? { valor } : undefined),
  DATA: (valor) => {
    if (typeof valor !== 'string') return undefined;
    const formatada = formatarDataBr(valor, 'short');
    return { valor: formatada === '' ? valor : formatada };
  },
  NUMERO: (valor) =>
    typeof valor === 'string' || typeof valor === 'number'
      ? { valor: formatarDecimalExato(String(valor)) }
      : undefined,
  OPCAO: (valor) => {
    const rotulo = opcaoRotulo(valor);
    return rotulo === null ? undefined : { valor: rotulo };
  },
  OPCOES: (valor) =>
    Array.isArray(valor)
      ? { valor: valor.map(opcaoRotulo).filter((r): r is string => r !== null) }
      : undefined,
  ENDERECO: (valor) => (ehRegistro(valor) ? endereco(valor) : undefined),
};

/** O valor na forma que o `tipo` define; `undefined` quando o valor não tem essa forma. */
function lidoPeloTipo(tipo: string, valor: unknown): ValorExibido | undefined {
  return Object.hasOwn(LEITORES_POR_TIPO, tipo) ? LEITORES_POR_TIPO[tipo](valor) : undefined;
}

const comoVeio: Leitor = (valor) => (typeof valor === 'string' ? { valor } : undefined);

const LEITORES_POR_EXIBICAO: Readonly<Record<string, Leitor>> = {
  CPF: comoVeio,
  IDENTIFICADOR: comoVeio,
  MOEDA: (valor) =>
    typeof valor === 'string' || typeof valor === 'number'
      ? { valor: formatarMoeda(String(valor)) }
      : undefined,
  SITUACAO: (valor) =>
    typeof valor === 'string' && ehSituacaoConhecida(valor) ? { situacao: valor } : undefined,
};

function lidoPeloComponente(componente: string, valor: unknown): ValorExibido | undefined {
  return Object.hasOwn(LEITORES_POR_EXIBICAO, componente)
    ? LEITORES_POR_EXIBICAO[componente](valor)
    : undefined;
}

/**
 * O valor de uma resposta segundo o `componente` e o `tipo` que a API declara. O componente
 * específico (CPF e identificador, que chegam já mascarados e a tela exibe como vieram; moeda;
 * situação) vale quando o valor tem a forma dele; senão, e no `PADRAO` ou em componente que a tela
 * não conhece, a exibição é a do `tipo`. O valor que não tem a forma do tipo, ou de um tipo que a
 * tela não conhece, passa ao componente de valor quando é texto, número ou booleano, e some quando
 * não há o que mostrar (objeto ou lista sem forma conhecida).
 */
export function valorExibido(tipo: string, valor: unknown, componente = 'PADRAO'): ValorExibido {
  if (valor === null || valor === undefined) return SEM_VALOR;
  const lido = lidoPeloComponente(componente, valor) ?? lidoPeloTipo(tipo, valor);
  if (lido !== undefined) return lido;
  return typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean'
    ? { valor }
    : SEM_VALOR;
}
