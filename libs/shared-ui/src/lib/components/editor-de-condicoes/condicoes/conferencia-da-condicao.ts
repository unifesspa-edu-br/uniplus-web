import { comparaComLista, ehNegacao } from '../../formulario-do-candidato/interpretador/predicado';
import { FatoEscolhivel, rotuloDoValor } from './fatos-escolhiveis';
import {
  CondicaoDeFato,
  VALOR_FALSO,
  VALOR_VERDADEIRO,
  valorEscalarDe,
  valoresDeListaDe,
} from './valor-da-condicao';

/**
 * O que a condição alcança, na prosa que o operador lê antes de gravar.
 *
 * É o que torna consciente a escolha entre "não é feminino" e "é masculino": a primeira
 * também alcança quem declarou qualquer outro valor do domínio, e quem escreve a regra
 * precisa ver isso na tela, não descobrir depois pela reclamação de um candidato.
 */
export function alcanceDaCondicao(condicao: CondicaoDeFato, fato: FatoEscolhivel): string {
  if (fato.tipoDominio === 'BOOLEANO') return alcanceBooleano(condicao);
  if (fato.valores.length === 0) return '';

  const escolhidos = valoresEscolhidos(condicao);
  if (escolhidos.length === 0) return '';

  const nega = ehNegacao(condicao.operador);
  const alcancados = fato.valores.filter((valor) => escolhidos.includes(valor) !== nega);

  if (alcancados.length === 0) return 'Não alcança valor nenhum do domínio declarado.';
  return `Alcança ${alcancados.map((valor) => rotuloDoValor(fato, valor)).join(', ')}.`;
}

function valoresEscolhidos(condicao: CondicaoDeFato): readonly string[] {
  return comparaComLista(condicao.operador)
    ? valoresDeListaDe(condicao)
    : [valorEscalarDe(condicao)].filter((valor) => valor !== '');
}

/**
 * O que a condição sobre um fato de sim-ou-não alcança, dito por extenso.
 *
 * "não é não" é o que o operador acaba de declarar quando escolhe "não" com a comparação
 * negada, e ler isso de volta em prosa é o que evita a dupla negação passar despercebida.
 */
function alcanceBooleano(condicao: CondicaoDeFato): string {
  const escolhido = valorEscalarDe(condicao);
  if (escolhido !== VALOR_VERDADEIRO && escolhido !== VALOR_FALSO) return '';

  const nega = condicao.operador === 'DIFERENTE';
  const afirmativo = (escolhido === VALOR_VERDADEIRO) !== nega;
  return afirmativo ? 'Alcança quem respondeu que sim.' : 'Alcança quem respondeu que não.';
}

/**
 * O que impede UMA condição de ser gravada, ou `null` quando ela está íntegra. Espelha o
 * validador do domínio: fato fora do vocabulário, operador que o domínio não admite, valor
 * ausente e valor fora do domínio declarado.
 */
export function problemaDaCondicao(
  condicao: CondicaoDeFato,
  fatosPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
  nomeNoCatalogo: ReadonlyMap<string, string> = new Map(),
): string | null {
  // Fato ainda não escolhido não é fato desconhecido: dizer que o fato "" não está no
  // catálogo manda procurar no cadastro o que só falta selecionar na tela.
  if (condicao.fato.trim() === '') return 'escolha o fato do candidato';
  const fato = fatosPorCodigo.get(condicao.fato);
  if (fato === undefined) return problemaDoFatoAusente(condicao.fato, nomeNoCatalogo);
  if (!fato.operadoresAdmitidos.some((opcao) => opcao.codigo === condicao.operador)) {
    return `"${fato.nome}" não admite a comparação escolhida`;
  }
  return problemaDoValor(condicao, fato);
}

function problemaDoFatoAusente(codigo: string, nomeNoCatalogo: ReadonlyMap<string, string>) {
  const nome = nomeNoCatalogo.get(codigo);
  return nome === undefined
    ? `o fato "${codigo}" não está no catálogo`
    : `"${nome}" não tem valor nenhum ofertado por este processo`;
}

/**
 * A gramática exata de número inteiro do JSON: zero à esquerda não é número JSON válido. O domínio
 * numérico recusa decimal; sem esta conferência o valor viajava e voltava recusado pelo servidor,
 * falando de um tipo que a tela não expõe — um `018` aprovado aqui voltaria como recusa de TIPO,
 * uma mensagem sobre JSON para quem só pôs um zero a mais.
 */
const INTEIRO_DO_JSON = /^-?(0|[1-9]\d*)$/;

function problemaDoValor(condicao: CondicaoDeFato, fato: FatoEscolhivel): string | null {
  const escolhidos = valoresEscolhidos(condicao);
  if (escolhidos.length === 0) return `"${fato.nome}" está sem valor`;
  if (fato.tipoDominio === 'NUMERICO' && !INTEIRO_DO_JSON.test(escolhidos[0])) {
    return `"${fato.nome}" aceita número inteiro`;
  }
  return problemaDoDominio(fato, escolhidos);
}

function problemaDoDominio(fato: FatoEscolhivel, escolhidos: readonly string[]): string | null {
  const foraDoDominio =
    fato.valores.length === 0 ? [] : escolhidos.filter((valor) => !fato.valores.includes(valor));
  return foraDoDominio.length > 0
    ? `"${fato.nome}" cita ${foraDoDominio.join(', ')}, fora do domínio declarado`
    : null;
}

/**
 * Os problemas de uma lista de condições, na ordem. `ignorados` são os fatos que outro
 * controle da tela confere por conta própria.
 */
export function problemasDeCondicoes(
  condicoes: readonly CondicaoDeFato[],
  fatosPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
  nomeNoCatalogo: ReadonlyMap<string, string> = new Map(),
  ignorados: readonly string[] = [],
): readonly string[] {
  return condicoes
    .filter((condicao) => !ignorados.includes(condicao.fato))
    .map((condicao) => problemaDaCondicao(condicao, fatosPorCodigo, nomeNoCatalogo))
    .filter((problema): problema is string => problema !== null);
}
