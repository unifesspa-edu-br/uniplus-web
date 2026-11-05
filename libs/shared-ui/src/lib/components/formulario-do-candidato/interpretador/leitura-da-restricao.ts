import { diaDoCalendario } from '@uniplus/shared-utils';

import { lerCondicaoQueValeSempreSeVazia } from './leitura-do-predicado';
import { lista, numero, Recusa, textos } from './leitura-dos-valores';
import type { LimiteDeDataDasRegras, RestricaoDasRegras } from './regras-do-formulario';
import {
  FAIXA_DE_DATA,
  FAIXA_NUMERICA,
  faixaDeData,
  faixaNumerica,
  type LimiteDeData,
  minimaDepoisDaMaxima,
  MUNICIPIOS_DA_UF,
  municipiosDaUf,
  OPCOES_DAS_RESPOSTAS,
  OPCOES_PERMITIDAS,
  opcoesDasRespostas,
  opcoesPermitidas,
  type Restricao,
  TAMANHO_TEXTO,
  tamanhoDeTexto,
  TETO_DE_ANOS,
  TETO_DE_DIAS,
} from './restricoes';

/** Os limites numéricos que toda restrição pode trazer; lidos antes do tipo, como a API lê o corpo. */
interface Limites {
  readonly minimo: number | null;
  readonly maximo: number | null;
}

function lerLimites(restricao: RestricaoDasRegras, caminho: string): Limites {
  return {
    minimo: numero(restricao.minimo, `${caminho}.minimo`),
    maximo: numero(restricao.maximo, `${caminho}.maximo`),
  };
}

export function lerRestricao(restricao: RestricaoDasRegras, caminho: string): Restricao {
  const limites = lerLimites(restricao, caminho);
  switch (restricao.tipo) {
    case FAIXA_NUMERICA:
      return lerFaixaNumerica(limites, caminho);
    case TAMANHO_TEXTO:
      return lerTamanhoDeTexto(limites, caminho);
    case OPCOES_PERMITIDAS:
      return lerOpcoesPermitidas(restricao, caminho);
    case OPCOES_DAS_RESPOSTAS:
      return opcoesDasRespostas(
        textos(
          restricao.fatos,
          `${caminho}.fatos`,
          'As opções formadas pelas respostas precisam citar ao menos um fato.',
        ),
      );
    case MUNICIPIOS_DA_UF:
      return lerMunicipiosDaUf(restricao, caminho);
    case FAIXA_DE_DATA:
      return lerFaixaDeData(restricao, caminho);
    default:
      throw new Recusa(
        `${caminho}.tipo`,
        'O tipo da restrição é FAIXA_NUMERICA, TAMANHO_TEXTO, OPCOES_PERMITIDAS, OPCOES_DAS_RESPOSTAS, MUNICIPIOS_DA_UF ou FAIXA_DE_DATA.',
      );
  }
}

function lerFaixaNumerica({ minimo, maximo }: Limites, caminho: string): Restricao {
  if (minimo === null && maximo === null)
    throw new Recusa(caminho, 'A faixa numérica precisa de ao menos um limite.');
  if (minimo !== null && maximo !== null && minimo > maximo)
    throw new Recusa(caminho, `O mínimo (${minimo}) é maior que o máximo (${maximo}).`);
  return faixaNumerica(minimo, maximo);
}

function lerTamanhoDeTexto({ minimo, maximo }: Limites, caminho: string): Restricao {
  if ([minimo, maximo].some((limite) => limite !== null && !Number.isInteger(limite))) {
    throw new Recusa(caminho, 'Os limites de tamanho de texto são números inteiros.');
  }
  if (minimo === null && maximo === null)
    throw new Recusa(caminho, 'O tamanho de texto precisa de ao menos um limite.');
  if (limitesDeTamanhoIncoerentes({ minimo, maximo })) {
    throw new Recusa(caminho, `Os limites de tamanho (${minimo}, ${maximo}) são incoerentes.`);
  }
  return tamanhoDeTexto(minimo, maximo);
}

function limitesDeTamanhoIncoerentes({ minimo, maximo }: Limites): boolean {
  return (
    (minimo ?? 0) < 0 ||
    (maximo ?? 0) < 0 ||
    (minimo !== null && maximo !== null && minimo > maximo)
  );
}

function lerOpcoesPermitidas(restricao: RestricaoDasRegras, caminho: string): Restricao {
  const entradas = lista(restricao.entradas, `${caminho}.entradas`, (entrada, daEntrada) => ({
    quando: lerCondicaoQueValeSempreSeVazia(entrada.quando, `${daEntrada}.quando`),
    valores: textos(
      entrada.valores,
      `${daEntrada}.valores`,
      'Um grupo de opções precisa de valores não vazios.',
    ),
  }));
  if (entradas.length === 0)
    throw new Recusa(
      `${caminho}.entradas`,
      'As opções permitidas precisam de ao menos um grupo de valores.',
    );
  return opcoesPermitidas(entradas);
}

function lerMunicipiosDaUf(restricao: RestricaoDasRegras, caminho: string): Restricao {
  const fatos = textos(
    restricao.fatos,
    `${caminho}.fatos`,
    'Os municípios da UF citam exatamente um fato, o da UF.',
  );
  if (fatos.length !== 1)
    throw new Recusa(`${caminho}.fatos`, 'Os municípios da UF citam exatamente um fato, o da UF.');
  return municipiosDaUf(fatos[0]);
}

function lerFaixaDeData(restricao: RestricaoDasRegras, caminho: string): Restricao {
  const minima = lerLimiteDeData(restricao.dataMinima, `${caminho}.dataMinima`);
  const maxima = lerLimiteDeData(restricao.dataMaxima, `${caminho}.dataMaxima`);
  if (minima === null && maxima === null)
    throw new Recusa(caminho, 'A faixa de data precisa de ao menos um limite.');
  if (minima !== null && maxima !== null && minimaDepoisDaMaxima(minima, maxima))
    throw new Recusa(caminho, 'A data mínima fica depois da data máxima.');
  return faixaDeData(minima, maxima);
}

/**
 * Um limite da faixa de data, com as mesmas recusas da API: a data fixa é um dia do calendário sem
 * deslocamento, e o limite do envio é o deslocamento inteiro, dentro do teto, sem data.
 */
export function lerLimiteDeData(
  limite: LimiteDeDataDasRegras | null | undefined,
  caminho: string,
): LimiteDeData | null {
  if (limite === null || limite === undefined) return null;
  const anos = numero(limite.anos, `${caminho}.anos`);
  const dias = numero(limite.dias, `${caminho}.dias`);
  if (limite.ancora === 'DATA_FIXA') return lerDataFixa(limite, caminho, anos, dias);
  if (limite.ancora === 'ENVIO') return lerLimiteDoEnvio(limite, caminho, anos, dias);
  throw new Recusa(`${caminho}.ancora`, 'A âncora do limite de data é DATA_FIXA ou ENVIO.');
}

function lerDataFixa(
  limite: LimiteDeDataDasRegras,
  caminho: string,
  anos: number | null,
  dias: number | null,
): LimiteDeData {
  const data = limite.data;
  if (typeof data !== 'string' || diaDoCalendario(data) === null)
    throw new Recusa(
      `${caminho}.data`,
      'A data fixa do limite é um dia do calendário, AAAA-MM-DD.',
    );
  if (data === '0001-01-01')
    throw new Recusa(`${caminho}.data`, 'A data fixa do limite não pode ser 01/01/0001.');
  if ((anos ?? 0) !== 0 || (dias ?? 0) !== 0)
    throw new Recusa(caminho, 'O limite de data fixa não tem deslocamento.');
  return { ancora: 'DATA_FIXA', data };
}

function lerLimiteDoEnvio(
  limite: LimiteDeDataDasRegras,
  caminho: string,
  anos: number | null,
  dias: number | null,
): LimiteDeData {
  if (limite.data !== null && limite.data !== undefined)
    throw new Recusa(`${caminho}.data`, 'O limite contado do envio não tem data.');
  const deslocamento = { anos: anos ?? 0, dias: dias ?? 0 };
  if (!Number.isInteger(deslocamento.anos) || !Number.isInteger(deslocamento.dias))
    throw new Recusa(
      caminho,
      'O deslocamento do dia do envio é um número inteiro de anos e de dias.',
    );
  if (Math.abs(deslocamento.anos) > TETO_DE_ANOS || Math.abs(deslocamento.dias) > TETO_DE_DIAS)
    throw new Recusa(
      caminho,
      `O deslocamento do dia do envio vai até ${TETO_DE_ANOS} anos ou ${TETO_DE_DIAS} dias, para mais ou para menos.`,
    );
  return { ancora: 'ENVIO', ...deslocamento };
}
