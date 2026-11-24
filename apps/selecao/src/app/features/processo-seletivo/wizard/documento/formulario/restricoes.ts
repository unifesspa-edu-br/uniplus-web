import {
  ReferenciaDoLimiteDeData as ReferenciaDoLimite,
  TipoDaRestricaoDoFormulario as Tipo,
  type DocumentoDaConfiguracaoFormulario as Formulario,
} from '@uniplus/shared-data/selecao';
import type {
  CaminhoDoCampo as Caminho,
  RestricaoDeValor as RestricaoEditada,
  LimiteDeDataNoWire as LimiteEditado,
} from '@uniplus/shared-ui/components';
import type { ContextoDaConversao as Contexto } from './contexto-da-conversao';
import { lerPredicado, predicadoDoDocumento } from './obrigatoriedade';

type Item = NonNullable<Formulario['itens']>[number];
type Restricao = NonNullable<Item['restricoes']>[number];
type Limite = NonNullable<Restricao['dataMinima']>;
type Entrada = NonNullable<Restricao['entradas']>[number];
const CAMPOS: readonly (keyof Restricao)[] = [
  'tipo',
  'minimo',
  'maximo',
  'codigosDosDados',
  'entradas',
  'dataMinima',
  'dataMaxima',
];
const CAMPOS_DA_ENTRADA: readonly (keyof Entrada)[] = ['valores', 'quando'];
const CAMPOS_DO_LIMITE: readonly (keyof Limite)[] = ['referenciaDaData', 'data', 'anos', 'dias'];

export function lerRestricao(restricao: Restricao): RestricaoEditada {
  return {
    ...restricao,
    fatos: restricao.codigosDosDados,
    dataMinima: lerLimite(restricao.dataMinima),
    dataMaxima: lerLimite(restricao.dataMaxima),
    entradas: restricao.entradas?.map((entrada) => ({
      ...entrada,
      quando: lerPredicado(entrada.quando),
    })),
  };
}

function lerLimite(limite: Limite | null | undefined): LimiteEditado | null | undefined {
  return limite == null ? limite : { ...limite, ancora: limite.referenciaDaData };
}

function deslocamentoDoLimite(limite: LimiteEditado, contexto: Contexto, caminho: Caminho) {
  return {
    data: limite.data ?? undefined,
    anos: contexto.numero(limite.anos, [...caminho, 'anos'], true),
    dias: contexto.numero(limite.dias, [...caminho, 'dias'], true),
  };
}

function gravarLimite(
  limite: LimiteEditado | null | undefined,
  original: Limite | null | undefined,
  contexto: Contexto,
  caminho: Caminho,
): Limite | null | undefined {
  if (limite == null) return limite;
  const referencia = contexto.escolha(ReferenciaDoLimite, limite.ancora, [...caminho, 'ancora']);
  if (referencia === undefined) return undefined;
  const convertido: Limite = {
    referenciaDaData: referencia,
    ...deslocamentoDoLimite(limite, contexto, caminho),
  };
  return contexto.edicao.preservar(original ?? undefined, convertido, CAMPOS_DO_LIMITE, caminho);
}

function entradasDaRestricao(
  restricao: RestricaoEditada,
  original: Restricao | undefined,
  contexto: Contexto,
  caminho: Caminho,
): Restricao['entradas'] {
  return restricao.entradas?.map((entrada, indice) => {
    const local = [...caminho, 'entradas', String(indice)];
    const quando = predicadoDoDocumento(entrada.quando, contexto, [...local, 'quando']);
    const convertida: Entrada = { valores: entrada.valores, quando };
    const anterior = original?.entradas?.[indice];
    return contexto.edicao.preservar(anterior, convertida, CAMPOS_DA_ENTRADA, local);
  });
}

function faixaNumerica(restricao: RestricaoEditada, contexto: Contexto, caminho: Caminho) {
  return {
    minimo:
      restricao.minimo === null ? null : contexto.numero(restricao.minimo, [...caminho, 'minimo']),
    maximo:
      restricao.maximo === null ? null : contexto.numero(restricao.maximo, [...caminho, 'maximo']),
  };
}

function faixaDeData(
  restricao: RestricaoEditada,
  original: Restricao | undefined,
  contexto: Contexto,
  caminho: Caminho,
) {
  const localMinimo = [...caminho, 'dataMinima'];
  const localMaximo = [...caminho, 'dataMaxima'];
  return {
    dataMinima: gravarLimite(restricao.dataMinima, original?.dataMinima, contexto, localMinimo),
    dataMaxima: gravarLimite(restricao.dataMaxima, original?.dataMaxima, contexto, localMaximo),
  };
}

function camposDaRestricao(
  restricao: RestricaoEditada,
  original: Restricao | undefined,
  contexto: Contexto,
  caminho: Caminho,
) {
  return {
    ...faixaNumerica(restricao, contexto, caminho),
    ...faixaDeData(restricao, original, contexto, caminho),
    codigosDosDados: restricao.fatos ?? undefined,
    entradas: entradasDaRestricao(restricao, original, contexto, caminho),
  };
}

export function gravarRestricao(
  restricao: RestricaoEditada,
  original: Restricao | undefined,
  contexto: Contexto,
  caminho: Caminho,
): Restricao | undefined {
  const tipo = contexto.escolha(Tipo, restricao.tipo, [...caminho, 'tipo']);
  if (tipo === undefined) return undefined;
  const convertida: Restricao = {
    tipo,
    ...camposDaRestricao(restricao, original, contexto, caminho),
  };
  return contexto.edicao.preservar(original, convertida, CAMPOS, caminho);
}
