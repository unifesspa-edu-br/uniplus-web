import type { UiValorEmConsulta } from '@uniplus/shared-ui/components';
import { formatarDataBr } from '@uniplus/shared-utils';

import { ehSituacaoConhecida } from './situacao-da-inscricao';

/**
 * O valor de uma resposta pronto para a tela: o endereço sai em linhas; o resto, no valor em
 * consulta, cuja apresentação (Sim/Não, lista, "Não informado") é do `ui-valor-apresentado`.
 */
export type ValorExibido =
  | { readonly linhas: readonly string[] }
  | { readonly situacao: string }
  | { readonly valor: UiValorEmConsulta };

const SEM_VALOR: ValorExibido = { valor: null };

const DECIMAL_EXATO = /^(-?)(\d+)(?:\.(\d+))?$/;
const MILHAR = /\B(?=(\d{3})+(?!\d))/g;
const HORA_DO_DIA = /^\d{2}:\d{2}(?::\d{2})?$/;
/** Dia fixo para ler a hora de parede pelo formatador de data, que só lê instante ou data e hora. */
const DIA_DA_HORA = '1970-01-01';

function ehRegistro(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

/**
 * O decimal exato da API com vírgula decimal e sem separador de milhar, como o formulário do
 * candidato escreve o número, por manipulação do texto: passar por `Number` perderia a precisão
 * que o contrato preserva. Texto que não é decimal volta como veio.
 */
export function formatarDecimalExato(decimal: string): string {
  const partes = DECIMAL_EXATO.exec(decimal.trim());
  if (partes === null) return decimal;
  const [, sinal, inteiro, fracao] = partes;
  return `${sinal}${inteiro}${fracao === undefined ? '' : `,${fracao}`}`;
}

/**
 * O decimal exato da API como valor em reais, "R$ 1.234,56", por manipulação do texto: sem `Number`,
 * a precisão do contrato se mantém. Ao menos duas casas decimais; texto que não é decimal volta como veio.
 */
export function formatarMoeda(decimal: string): string {
  const partes = DECIMAL_EXATO.exec(decimal.trim());
  if (partes === null) return decimal;
  const [, sinal, inteiro, fracao = ''] = partes;
  return `${sinal}R$ ${inteiro.replace(MILHAR, '.')},${fracao.padEnd(2, '0')}`;
}

function opcaoRotulo(valor: unknown): string | null {
  return ehRegistro(valor) ? texto(valor['rotulo']) : null;
}

function endereco(valor: Readonly<Record<string, unknown>>): ValorExibido {
  const campo = (nome: string): string | null => texto(valor[nome]);
  const via = [campo('logradouro'), campo('numero')].filter((p) => p !== null).join(', ');
  const complemento = campo('complemento');
  const cidade = [campo('municipio'), campo('uf')].filter((p) => p !== null).join('/');
  const cep = campo('cep');
  const linhas = [
    complemento === null || via === '' ? via || complemento : `${via} — ${complemento}`,
    campo('bairro'),
    cidade,
    cep === null ? null : `CEP ${cep}`,
  ].filter((linha): linha is string => linha !== null && linha !== '');
  return linhas.length === 0 ? SEM_VALOR : { linhas };
}

function hora(valor: string): string {
  if (!HORA_DO_DIA.test(valor)) return valor;
  const formatada = formatarDataBr(`${DIA_DA_HORA}T${valor}`, 'hora');
  return formatada === '' ? valor : formatada;
}

type Leitor = (valor: unknown) => ValorExibido | undefined;

function dataLidaComo(formato: 'short' | 'datetime'): Leitor {
  return (valor) => {
    if (typeof valor !== 'string') return undefined;
    const formatada = formatarDataBr(valor, formato);
    return { valor: formatada === '' ? valor : formatada };
  };
}

const LEITORES_POR_TIPO: Readonly<Record<string, Leitor>> = {
  booleano: (valor) => (typeof valor === 'boolean' ? { valor } : undefined),
  data: dataLidaComo('short'),
  'data-hora': dataLidaComo('datetime'),
  hora: (valor) => (typeof valor === 'string' ? { valor: hora(valor) } : undefined),
  numero: (valor) =>
    typeof valor === 'string' || typeof valor === 'number'
      ? { valor: formatarDecimalExato(String(valor)) }
      : undefined,
  opcao: (valor) => {
    const rotulo = opcaoRotulo(valor);
    return rotulo === null ? undefined : { valor: rotulo };
  },
  opcoes: (valor) =>
    Array.isArray(valor)
      ? { valor: valor.map(opcaoRotulo).filter((r): r is string => r !== null) }
      : undefined,
  endereco: (valor) => (ehRegistro(valor) ? endereco(valor) : undefined),
};

/** O valor na forma que o `tipo` define; `undefined` quando o valor não tem essa forma. */
function lidoPeloTipo(tipo: string, valor: unknown): ValorExibido | undefined {
  return Object.hasOwn(LEITORES_POR_TIPO, tipo) ? LEITORES_POR_TIPO[tipo](valor) : undefined;
}

function lidoPeloComponente(componente: string, valor: unknown): ValorExibido | undefined {
  switch (componente) {
    case 'cpf':
    case 'identificador':
      return typeof valor === 'string' ? { valor } : undefined;
    case 'moeda':
      return typeof valor === 'string' || typeof valor === 'number'
        ? { valor: formatarMoeda(String(valor)) }
        : undefined;
    case 'situacao':
      return typeof valor === 'string' && ehSituacaoConhecida(valor)
        ? { situacao: valor }
        : undefined;
    default:
      return undefined;
  }
}

/**
 * O valor de uma resposta segundo o `componente` e o `tipo` que a API declara. O componente
 * específico (CPF e identificador, que chegam já mascarados e a tela exibe como vieram; moeda;
 * situação) vale quando o valor tem a forma dele; senão, e no `padrao` ou em componente que a tela
 * não conhece, a exibição é a do `tipo`. O valor que não tem a forma do tipo, ou de um tipo que a
 * tela não conhece, passa ao componente de valor quando é texto, número ou booleano, e some quando
 * não há o que mostrar (objeto ou lista sem forma conhecida).
 */
export function valorExibido(tipo: string, valor: unknown, componente = 'padrao'): ValorExibido {
  if (valor === null || valor === undefined) return SEM_VALOR;
  const lido = lidoPeloComponente(componente, valor) ?? lidoPeloTipo(tipo, valor);
  if (lido !== undefined) return lido;
  return typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean'
    ? { valor }
    : SEM_VALOR;
}
