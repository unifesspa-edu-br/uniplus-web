import type { ExigenciasDoRascunho, RegraDeComprovacao } from '../../processo-seletivo.models';
import { documentosDe } from './consulta-das-exigencias';
import { semAExigencia } from './exigencias-documentais';

export type EfeitoDaRemocao =
  | { tipo: 'semEfeitoNoGrupo'; documentos?: readonly string[] }
  | { tipo: 'quantidadeMinimaReduzida'; de: number; para: number }
  | { tipo: 'grupoComUmDocumento'; documento: string; de: number | null; para: number | null }
  | { tipo: 'grupoVazio' };

function grupoDaRegra(
  regras: readonly RegraDeComprovacao[],
  identificador: string,
): RegraDeComprovacao | null {
  for (const regra of regras) {
    if (regra.forma === 'DOCUMENTO') continue;
    if (regra.itens?.some((item) => item.identificadorNoRascunho === identificador)) return regra;
    const grupo = grupoDaRegra(regra.itens ?? [], identificador);
    if (grupo !== null) return grupo;
  }
  return null;
}

function encontrarRegra(
  regras: readonly RegraDeComprovacao[],
  identificador: string,
): RegraDeComprovacao | null {
  for (const regra of regras) {
    if (regra.identificadorNoRascunho === identificador) return regra;
    const encontrada = encontrarRegra(regra.itens ?? [], identificador);
    if (encontrada !== null) return encontrada;
  }
  return null;
}

export function efeitoDaRemocao(
  exigencias: ExigenciasDoRascunho,
  identificador: string,
): EfeitoDaRemocao {
  const grupo = grupoDaRegra(exigencias.regrasDeComprovacao, identificador);
  if (grupo === null) return { tipo: 'semEfeitoNoGrupo' };
  const restantes = semAExigencia(exigencias, identificador).regrasDeComprovacao;
  const restante = encontrarRegra(restantes, grupo.identificadorNoRascunho);
  if (restante === null) return { tipo: 'grupoVazio' };
  return efeitoNoGrupo(grupo, restante);
}

function efeitoNoGrupo(grupo: RegraDeComprovacao, restante: RegraDeComprovacao): EfeitoDaRemocao {
  const documentos = documentosDe(restante.itens ?? []).map(
    (documento) => documento.tipoDocumentoId,
  );
  if (restante.itens?.length === 1 && documentos.length === 1) {
    return {
      tipo: 'grupoComUmDocumento',
      documento: documentos[0],
      de: grupo.quantidadeMinima,
      para: restante.quantidadeMinima,
    };
  }
  return efeitoDaQuantidade(grupo, restante, documentos);
}

function efeitoDaQuantidade(
  grupo: RegraDeComprovacao,
  restante: RegraDeComprovacao,
  documentos: readonly string[],
): EfeitoDaRemocao {
  const de = grupo.quantidadeMinima;
  const para = restante.quantidadeMinima;
  return de !== null && para !== null && de > para
    ? { tipo: 'quantidadeMinimaReduzida', de, para }
    : { tipo: 'semEfeitoNoGrupo', documentos };
}

export function textoDoEfeito(
  efeito: EfeitoDaRemocao,
  nome: string,
  nomesRestantes: string,
): string {
  const remocao = `A exigência do documento ${nome} será removida nesta fase.`;
  if (efeito.tipo === 'semEfeitoNoGrupo')
    return textoSemReducao(remocao, nomesRestantes, efeito.documentos);
  if (efeito.tipo === 'grupoVazio')
    return `${remocao} A combinação ficará sem documentos e será removida.`;
  if (efeito.tipo === 'quantidadeMinimaReduzida')
    return textoDaReducao(remocao, efeito.de, efeito.para);
  return textoDoGrupoComUmDocumento(remocao, nomesRestantes, efeito);
}

function textoDaReducao(remocao: string, de: number, para: number): string {
  return `${remocao} A quantidade mínima exigida na combinação será reduzida de ${de} para ${para} documentos.`;
}

function textoSemReducao(remocao: string, nomes: string, documentos?: readonly string[]): string {
  return documentos ? `${remocao} A combinação continuará com: ${nomes}.` : remocao;
}

function textoDoGrupoComUmDocumento(
  remocao: string,
  nome: string,
  efeito: Extract<EfeitoDaRemocao, { tipo: 'grupoComUmDocumento' }>,
): string {
  const quantidade =
    efeito.de !== efeito.para
      ? ` A quantidade mínima será reduzida de ${efeito.de} para ${efeito.para}.`
      : '';
  return `${remocao} A combinação terá um só documento: ${nome}. Ela continuará existindo, com a mesma consequência e as mesmas bases legais.${quantidade}`;
}
