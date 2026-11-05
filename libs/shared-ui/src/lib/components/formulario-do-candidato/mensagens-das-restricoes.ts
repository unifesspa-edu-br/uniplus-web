import { formatarDataBr } from '@uniplus/shared-utils';

import { lerLimiteDeData } from './interpretador/leitura-da-restricao';
import type {
  CampoAvaliado,
  ItemDasRegras,
  RestricaoDasRegras,
} from './interpretador/regras-do-formulario';
import { diaDoLimite, FAIXA_DE_DATA } from './interpretador/restricoes';

const numeroBr = (valor: number): string => valor.toLocaleString('pt-BR');

/** Os dias `AAAA-MM-DD` que a faixa de data admite no dia do envio; o limite que não se sabe é nulo. */
export interface LimitesDeData {
  readonly minimo: string | null;
  readonly maximo: string | null;
}

/**
 * Os limites da faixa de data declarada no campo, resolvidos no dia do envio pela mesma conta que o
 * interpretador faz; nulo quando o campo não declara a faixa.
 */
export function limitesDaFaixaDeData(
  regra: ItemDasRegras | null,
  diaDoEnvio: string | null,
): LimitesDeData | null {
  const faixa = regra?.restricoes?.find((r) => r.tipo === FAIXA_DE_DATA);
  if (!faixa) return null;
  const resolver = (limite: RestricaoDasRegras['dataMinima']): string | null => {
    const lido = lerLimiteDeData(limite, '');
    return lido === null ? null : diaDoLimite(lido, diaDoEnvio);
  };
  return { minimo: resolver(faixa.dataMinima), maximo: resolver(faixa.dataMaxima) };
}

/** O que dizer ao candidato sobre os limites de data, com os dias em dd/mm/aaaa; nulo sem limite sabido. */
export function textoDosLimitesDeData(limites: LimitesDeData | null): string | null {
  const dia = (iso: string): string => formatarDataBr(iso, 'short');
  if (limites?.minimo && limites.maximo)
    return `Informe uma data entre ${dia(limites.minimo)} e ${dia(limites.maximo)}.`;
  if (limites?.maximo) return `Informe uma data até ${dia(limites.maximo)}.`;
  if (limites?.minimo) return `Informe uma data a partir de ${dia(limites.minimo)}.`;
  return null;
}

/** A mensagem de cada restrição que a resposta viola, montada com os limites que a regra declara. */
export function mensagensDasRestricoes(
  avaliado: CampoAvaliado,
  regra: ItemDasRegras | null,
  diaDoEnvio: string | null,
): string[] {
  return avaliado.restricoesVioladas.map((tipo) => mensagemDaRestricao(tipo, regra, diaDoEnvio));
}

interface ContextoDaMensagem {
  readonly regra: ItemDasRegras | null;
  readonly restricao: RestricaoDasRegras | undefined;
  readonly diaDoEnvio: string | null;
}

const MENSAGEM_PELO_TIPO: Readonly<Record<string, (contexto: ContextoDaMensagem) => string>> = {
  FAIXA_NUMERICA: ({ restricao }) =>
    mensagemDaFaixaNumerica(restricao?.minimo ?? null, restricao?.maximo ?? null),
  TAMANHO_TEXTO: ({ restricao }) =>
    mensagemDoTamanhoDoTexto(restricao?.minimo ?? null, restricao?.maximo ?? null),
  OPCOES_PERMITIDAS: () => 'Escolha uma das opções oferecidas.',
  OPCOES_DAS_RESPOSTAS: () => 'Escolha uma das opções oferecidas.',
  MUNICIPIOS_DA_UF: () => 'Escolha um município da UF informada.',
  [FAIXA_DE_DATA]: ({ regra, diaDoEnvio }) =>
    textoDosLimitesDeData(limitesDaFaixaDeData(regra, diaDoEnvio)) ??
    'A data não está dentro dos limites do campo.',
  FORMATO_TEXTO: ({ regra }) =>
    MENSAGEM_DO_FORMATO[regra?.formato ?? ''] ?? 'A resposta não está no formato esperado.',
};

function mensagemDaRestricao(
  tipo: string,
  regra: ItemDasRegras | null,
  diaDoEnvio: string | null,
): string {
  const restricao = regra?.restricoes?.find((r) => r.tipo === tipo);
  const mensagem = Object.hasOwn(MENSAGEM_PELO_TIPO, tipo) ? MENSAGEM_PELO_TIPO[tipo] : null;
  return mensagem
    ? mensagem({ regra, restricao, diaDoEnvio })
    : 'A resposta não atende à regra do campo.';
}

function mensagemDaFaixaNumerica(minimo: number | null, maximo: number | null): string {
  if (minimo !== null && maximo !== null)
    return `Informe um número entre ${numeroBr(minimo)} e ${numeroBr(maximo)}.`;
  if (minimo !== null) return `Informe um número igual ou maior que ${numeroBr(minimo)}.`;
  return `Informe um número igual ou menor que ${numeroBr(maximo ?? 0)}.`;
}

function mensagemDoTamanhoDoTexto(minimo: number | null, maximo: number | null): string {
  if (minimo !== null && maximo !== null) return `Escreva de ${minimo} a ${maximo} caracteres.`;
  if (minimo !== null) return `Escreva ao menos ${minimo} caracteres.`;
  return `Escreva no máximo ${maximo ?? 0} caracteres.`;
}

const MENSAGEM_DO_FORMATO: Readonly<Record<string, string>> = {
  CPF: 'Informe um CPF válido.',
  EMAIL: 'Informe um e-mail válido.',
  TELEFONE: 'Informe o telefone com DDD.',
  CEP: 'Informe o CEP com os oito dígitos.',
  NOME_PESSOA: 'Informe nome e sobrenome, só com letras.',
};
