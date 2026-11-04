import { SECAO_DADOS_BASICOS, type ConteudoDoFormulario } from '@uniplus/shared-ui/components';
import type { ExigenciasDoRascunho } from '../../processo-seletivo.models';
import { todasAsExigencias } from '../../shared/exigencias/consulta-das-exigencias';
import { fatosColetadosPor } from './formulario-do-processo';

/**
 * O formulário de inscrição do certame e o que o resto do processo exige dele.
 *
 * Os campos SÃO os fatos coletados — a renderização pública projeta exatamente os itens, na ordem
 * declarada. Por isso "declarar um campo" e "declarar que o certame coleta um fato" são a mesma
 * decisão, e uma exigência condicionada a um fato pressupõe o campo dele.
 */

/**
 * Os fatos do conjunto básico do candidato, que a API põe na seção reservada de todo formulário de
 * inscrição (`ConjuntoBasicoDaInscricao`). Valem como coletados antes de o formulário existir no
 * servidor: acrescentar um deles fora da seção reservada seria recusado como alteração dos dados
 * básicos. Depois da criação, a referência é a seção que o servidor devolve.
 */
export const FATOS_DO_CONJUNTO_BASICO: readonly string[] = [
  'NOME',
  'DESEJA_NOME_SOCIAL',
  'NOME_SOCIAL',
  'NACIONALIDADE',
  'CPF',
  'RG_NUMERO',
  'RG_ORGAO_EMISSOR',
  'RG_ORGAO_EMISSOR_OUTRO',
  'RG_UF',
  'RG_DATA_EMISSAO',
  'PASSAPORTE_NUMERO',
  'RNM_NUMERO',
  'DATA_NASCIMENTO',
  'NATURALIDADE_UF',
  'NATURALIDADE_MUNICIPIO',
  'NOME_MAE',
  'NOME_PAI',
  'ESTADO_CIVIL',
  'SEXO',
  'COR_RACA',
  'EMAIL',
  'TELEFONE',
  'TIPO_ENDERECO',
  'NOME_COMUNIDADE',
  'ENDERECO_RESIDENCIAL',
];

/** A seção em que entram os campos que as exigências pressupõem. Código fixo: é reaproveitada. */
export const SECAO_OUTROS_DADOS = 'OUTROS_DADOS_EXIGIDOS';
export const TITULO_SECAO_OUTROS_DADOS = 'Outros dados exigidos pelo certame';

/** O conjunto básico enquanto a seção dele ainda não chegou do servidor; depois, a seção o traz. */
function basicosAindaNaoGravados(conteudo: ConteudoDoFormulario): readonly string[] {
  return (conteudo.etapas ?? []).some((etapa) => etapa.codigo === SECAO_DADOS_BASICOS)
    ? []
    : FATOS_DO_CONJUNTO_BASICO;
}

/**
 * Os fatos que o formulário de inscrição coleta, contando o conjunto básico enquanto a seção dele
 * ainda não chegou do servidor.
 */
export function fatosColetadosPelaInscricao(conteudo: ConteudoDoFormulario): ReadonlySet<string> {
  return new Set([...fatosColetadosPor(conteudo), ...basicosAindaNaoGravados(conteudo)]);
}

/**
 * O que o editor da inscrição não oferece para coletar: o que as outras finalidades coletam e o
 * conjunto básico ainda não gravado, que a API põe na seção reservada e recusa em outra seção.
 */
export function fatosForaDaColetaDaInscricao(
  conteudo: ConteudoDoFormulario,
  dasOutrasFinalidades: readonly string[],
): readonly string[] {
  return [...dasOutrasFinalidades, ...basicosAindaNaoGravados(conteudo)];
}

/**
 * Os fatos que alguma exigência documental cita no gatilho dela. Percorre a árvore inteira, porque
 * a exigência pode estar dentro de um grupo.
 */
export function fatosCitadosPelasExigencias(exigencias: ExigenciasDoRascunho): ReadonlySet<string> {
  const citados = new Set<string>();
  for (const exigencia of todasAsExigencias(exigencias)) {
    for (const condicao of exigencia.condicoes) {
      citados.add(condicao.fato);
    }
  }
  return citados;
}
