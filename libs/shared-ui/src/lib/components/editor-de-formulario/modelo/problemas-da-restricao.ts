import { diaDoCalendario } from '@uniplus/shared-utils';
import {
  minimaDepoisDaMaxima,
  TETO_DE_ANOS,
  TETO_DE_DIAS,
} from '../../formulario-do-candidato/interpretador/restricoes';
import {
  ANCORA_DATA_FIXA,
  CASAS_DECIMAIS_DA_FAIXA,
  RESTRICAO_FAIXA_DE_DATA,
  RESTRICAO_FAIXA_NUMERICA,
  RESTRICAO_MUNICIPIOS_DA_UF,
  RESTRICAO_OPCOES_DAS_RESPOSTAS,
  RESTRICAO_OPCOES_PERMITIDAS,
  RESTRICAO_TAMANHO_TEXTO,
} from './restricoes-de-valor';
import { LimiteDeDataNoWire, OpcoesCondicionadas, RestricaoDeValor } from './tipos';

/** O que impede a restrição de ser gravada, nos termos da API (`RestricaoValor.Violacao`); nulo quando nada. */
export function problemaDaRestricao(restricao: RestricaoDeValor): string | null {
  return PROBLEMA_POR_TIPO.get(restricao.tipo)?.(restricao) ?? null;
}

const SEM_LIMITE = 'Informe ao menos um limite.';
const MINIMO_MAIOR = 'O mínimo é maior que o máximo.';

type Limite = null | number | string;

function limitesDa(restricao: RestricaoDeValor): readonly [Limite, Limite] {
  return [restricao.minimo ?? null, restricao.maximo ?? null];
}

function minimoDepoisDoMaximo([minimo, maximo]: readonly [Limite, Limite]): boolean {
  return minimo !== null && maximo !== null && Number(minimo) > Number(maximo);
}

function problemaDaFaixaNumerica(restricao: RestricaoDeValor): string | null {
  const limites = limitesDa(restricao);
  if (limites.every((limite) => limite === null)) return SEM_LIMITE;
  if (limites.some((limite) => limite !== null && !Number.isFinite(Number(limite)))) {
    return 'Os limites são números.';
  }
  const alemDasCasas = (limite: Limite): boolean =>
    limite !== null && Number(Number(limite).toFixed(CASAS_DECIMAIS_DA_FAIXA)) !== Number(limite);
  if (limites.some(alemDasCasas)) return `Use no máximo ${CASAS_DECIMAIS_DA_FAIXA} casas decimais.`;
  return minimoDepoisDoMaximo(limites) ? MINIMO_MAIOR : null;
}

function problemaDoTamanhoDoTexto(restricao: RestricaoDeValor): string | null {
  const limites = limitesDa(restricao);
  if (limites.every((limite) => limite === null)) return SEM_LIMITE;
  const naoInteiro = (limite: Limite): boolean =>
    limite !== null && !(Number.isInteger(Number(limite)) && Number(limite) >= 0);
  if (limites.some(naoInteiro)) return 'Os limites são números inteiros, a partir de zero.';
  return minimoDepoisDoMaximo(limites) ? MINIMO_MAIOR : null;
}

const PROBLEMA_POR_TIPO: ReadonlyMap<string, (restricao: RestricaoDeValor) => string | null> =
  new Map([
    [RESTRICAO_FAIXA_NUMERICA, problemaDaFaixaNumerica],
    [RESTRICAO_TAMANHO_TEXTO, problemaDoTamanhoDoTexto],
    // O grupo sem valor tem o problema dele, mostrado no próprio grupo (`problemaDoGrupoDeOpcoes`).
    [
      RESTRICAO_OPCOES_PERMITIDAS,
      (restricao) =>
        (restricao.entradas ?? []).length === 0 ? 'Declare ao menos um grupo de opções.' : null,
    ],
    [
      RESTRICAO_OPCOES_DAS_RESPOSTAS,
      (restricao) =>
        (restricao.fatos ?? []).length === 0
          ? 'Escolha ao menos um campo de onde vêm as opções.'
          : null,
    ],
    [
      RESTRICAO_MUNICIPIOS_DA_UF,
      (restricao) =>
        (restricao.fatos ?? []).length === 1
          ? null
          : 'Escolha o campo de UF de onde vêm os municípios.',
    ],
    [RESTRICAO_FAIXA_DE_DATA, problemaDaFaixaDeData],
  ]);

/** Deslocamento ausente ou zero: não precisa ser conferido como número inteiro. */
const ZERO_OU_AUSENTE = (valor: null | number | string | undefined): boolean =>
  valor === null || valor === undefined || Number(valor) === 0;

const deslocamentoNaoInteiro = (valor: null | number | string | undefined): boolean =>
  !ZERO_OU_AUSENTE(valor) && !Number.isInteger(Number(valor));
const acimaDoTeto = (valor: null | number | string | undefined, teto: number): boolean =>
  Math.abs(Number(valor ?? 0)) > teto;

/** O que impede os anos do deslocamento de serem gravados, pelo valor deles; nulo quando nada. */
export function problemaDosAnos(valor: null | number | string | undefined): string | null {
  if (deslocamentoNaoInteiro(valor)) return 'Os anos são um número inteiro.';
  return acimaDoTeto(valor, TETO_DE_ANOS)
    ? `Os anos vão até ${TETO_DE_ANOS}, para mais ou para menos.`
    : null;
}

/** O que impede os dias do deslocamento de serem gravados, pelo valor deles; nulo quando nada. */
export function problemaDosDias(valor: null | number | string | undefined): string | null {
  if (deslocamentoNaoInteiro(valor)) return 'Os dias são um número inteiro.';
  return acimaDoTeto(valor, TETO_DE_DIAS)
    ? `Os dias vão até ${TETO_DE_DIAS}, para mais ou para menos.`
    : null;
}

/**
 * O que impede o limite da faixa de data de ser gravado, nos termos da API; nulo quando nada. Mostrado
 * no controle do limite, e não na restrição.
 */
export function problemaDoLimiteDeData(
  limite: LimiteDeDataNoWire | null | undefined,
): string | null {
  if (limite === null || limite === undefined) return null;
  return limite.ancora === ANCORA_DATA_FIXA
    ? problemaDaDataFixa(limite.data ?? '')
    : problemaDoDeslocamento(limite);
}

function problemaDaDataFixa(data: string): string | null {
  if (data === '') return 'Informe a data.';
  if (diaDoCalendario(data) === null) return 'Use uma data do calendário, no formato dia/mês/ano.';
  return data === '0001-01-01' ? 'A data não pode ser 01/01/0001.' : null;
}

function problemaDoDeslocamento(limite: LimiteDeDataNoWire): string | null {
  if ([limite.anos, limite.dias].some(deslocamentoNaoInteiro)) {
    return 'Os anos e os dias são números inteiros.';
  }
  if (acimaDoTeto(limite.anos, TETO_DE_ANOS) || acimaDoTeto(limite.dias, TETO_DE_DIAS)) {
    return `O deslocamento vai até ${TETO_DE_ANOS} anos ou ${TETO_DE_DIAS} dias, para mais ou para menos.`;
  }
  return null;
}

/**
 * O problema da faixa como um todo: ao menos um limite e a mínima não depois da máxima. A ordem que
 * depende do dia do envio não é recusada, como na API; o problema de cada limite é o dele.
 */
function problemaDaFaixaDeData(restricao: RestricaoDeValor): string | null {
  const minima = restricao.dataMinima ?? null;
  const maxima = restricao.dataMaxima ?? null;
  if (minima === null && maxima === null) return 'Informe ao menos um limite.';
  if (
    minima === null ||
    maxima === null ||
    problemaDoLimiteDeData(minima) !== null ||
    problemaDoLimiteDeData(maxima) !== null
  )
    return null;
  return minimaDepoisDaMaxima(limiteLido(minima), limiteLido(maxima))
    ? 'A data mínima fica depois da data máxima.'
    : null;
}

function limiteLido(limite: LimiteDeDataNoWire): Parameters<typeof minimaDepoisDaMaxima>[0] {
  return limite.ancora === ANCORA_DATA_FIXA
    ? { ancora: 'DATA_FIXA', data: limite.data ?? '' }
    : { ancora: 'ENVIO', anos: Number(limite.anos ?? 0), dias: Number(limite.dias ?? 0) };
}

/** O que impede o grupo de opções de ser gravado (`OpcoesCondicionadas.Violacao`); nulo quando nada. */
export function problemaDoGrupoDeOpcoes(entrada: OpcoesCondicionadas): string | null {
  return entrada.valores.length === 0 ? 'Escolha ao menos um valor permitido.' : null;
}
