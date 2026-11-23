import type { ExigenciasDoRascunho, RegraDeComprovacao } from '../../processo-seletivo.models';
import { documentosDe } from './consulta-das-exigencias';

type FormaDoGrupo = 'TODOS_OS_ITENS' | 'QUANTIDADE_MINIMA_DE_ITENS';

function mesmoMomento(regras: readonly RegraDeComprovacao[]): boolean {
  const documentos = documentosDe(regras);
  const primeiro = documentos[0];
  return (
    primeiro !== undefined &&
    documentos.every(
      (documento) =>
        documento.faseCodigo === primeiro.faseCodigo &&
        documento.etapaId === primeiro.etapaId &&
        documento.finalidade === primeiro.finalidade,
    )
  );
}

function alterarGrupo(
  regras: readonly RegraDeComprovacao[],
  identificador: string,
  alterar: (grupo: RegraDeComprovacao) => RegraDeComprovacao,
): readonly RegraDeComprovacao[] {
  return regras.map((regra) => {
    if (regra.forma === 'DOCUMENTO') return regra;
    if (regra.identificadorNoRascunho === identificador) return alterar(regra);
    return { ...regra, itens: alterarGrupo(regra.itens ?? [], identificador, alterar) };
  });
}

const DADOS_INICIAIS_DO_GRUPO = {
  documento: null,
  quantidadeMinima: 1,
  consequencia: null,
  basesLegais: null,
  criterioDeDistincao: null,
  dataReferencia: null,
  ocorrenciasEsperadas: null,
  grupoDoFormularioParaRepeticao: null,
} as const;

function grupoNovo(
  identificador: string,
  itens: readonly RegraDeComprovacao[],
): RegraDeComprovacao {
  return {
    ...DADOS_INICIAIS_DO_GRUPO,
    identificadorNoRascunho: identificador,
    forma: 'QUANTIDADE_MINIMA_DE_ITENS',
    itens,
  };
}

function documentosEscolhidosSaoValidos(
  exigencias: ExigenciasDoRascunho,
  itens: readonly RegraDeComprovacao[],
  quantidade: number,
): boolean {
  return (
    itens.length >= 2 &&
    itens.length === quantidade &&
    mesmoMomento(itens) &&
    itens.every((item) => documentoSolto(exigencias, item))
  );
}

function documentoSolto(exigencias: ExigenciasDoRascunho, item: RegraDeComprovacao): boolean {
  return (
    item.forma === 'DOCUMENTO' &&
    item.documento !== null &&
    !exigencias.emTodasAsFases.includes(item.documento.tipoDocumentoId)
  );
}

export function criarGrupo(
  exigencias: ExigenciasDoRascunho,
  identificadores: readonly string[],
  identificadorDoGrupo: string,
): ExigenciasDoRascunho {
  const escolhidos = new Set(identificadores);
  const itens = exigencias.regrasDeComprovacao.filter((regra) =>
    escolhidos.has(regra.identificadorNoRascunho),
  );
  if (!documentosEscolhidosSaoValidos(exigencias, itens, escolhidos.size)) return exigencias;
  return agruparDocumentos(exigencias, itens, identificadorDoGrupo);
}

function agruparDocumentos(
  exigencias: ExigenciasDoRascunho,
  itens: readonly RegraDeComprovacao[],
  identificador: string,
): ExigenciasDoRascunho {
  const restantes = exigencias.regrasDeComprovacao.filter((regra) => !itens.includes(regra));
  return { ...exigencias, regrasDeComprovacao: [...restantes, grupoNovo(identificador, itens)] };
}

export function editarGrupo(
  exigencias: ExigenciasDoRascunho,
  identificador: string,
  alteracao: Pick<RegraDeComprovacao, 'consequencia' | 'basesLegais'>,
): ExigenciasDoRascunho {
  return {
    ...exigencias,
    regrasDeComprovacao: alterarGrupo(exigencias.regrasDeComprovacao, identificador, (grupo) => ({
      ...grupo,
      ...alteracao,
    })),
  };
}

export function trocarCriterioDeDistincao(
  exigencias: ExigenciasDoRascunho,
  identificador: string,
  criterio: string | null,
): ExigenciasDoRascunho {
  return {
    ...exigencias,
    regrasDeComprovacao: alterarGrupo(exigencias.regrasDeComprovacao, identificador, (grupo) => ({
      ...grupo,
      criterioDeDistincao: criterio,
    })),
  };
}

export function trocarFormaDoGrupo(
  exigencias: ExigenciasDoRascunho,
  identificador: string,
  forma: FormaDoGrupo,
): ExigenciasDoRascunho {
  return {
    ...exigencias,
    regrasDeComprovacao: alterarGrupo(exigencias.regrasDeComprovacao, identificador, (grupo) => ({
      ...grupo,
      forma,
      quantidadeMinima: forma === 'TODOS_OS_ITENS' ? null : (grupo.quantidadeMinima ?? 1),
    })),
  };
}

export function trocarQuantidadeMinima(
  exigencias: ExigenciasDoRascunho,
  identificador: string,
  quantidade: number,
): ExigenciasDoRascunho {
  return {
    ...exigencias,
    regrasDeComprovacao: alterarGrupo(exigencias.regrasDeComprovacao, identificador, (grupo) => ({
      ...grupo,
      quantidadeMinima: quantidade,
    })),
  };
}

function encontrarGrupo(
  regras: readonly RegraDeComprovacao[],
  identificador: string,
): RegraDeComprovacao | undefined {
  for (const regra of regras) {
    if (regra.forma === 'DOCUMENTO') continue;
    if (regra.identificadorNoRascunho === identificador) return regra;
    const encontrada = encontrarGrupo(regra.itens ?? [], identificador);
    if (encontrada !== undefined) return encontrada;
  }
  return undefined;
}

export function incluirNoGrupo(
  exigencias: ExigenciasDoRascunho,
  identificadorDoGrupo: string,
  identificadorDoItem: string,
): ExigenciasDoRascunho {
  const regras = exigencias.regrasDeComprovacao;
  const item = regras.find((regra) => regra.identificadorNoRascunho === identificadorDoItem);
  const grupo = encontrarGrupo(regras, identificadorDoGrupo);
  if (!item || !grupo || !podeIncluir(exigencias, grupo, item)) return exigencias;
  return transferirAoGrupo(exigencias, grupo, item);
}

function transferirAoGrupo(
  exigencias: ExigenciasDoRascunho,
  grupo: RegraDeComprovacao,
  item: RegraDeComprovacao,
): ExigenciasDoRascunho {
  const restantes = exigencias.regrasDeComprovacao.filter((regra) => regra !== item);
  const regrasDeComprovacao = alterarGrupo(restantes, grupo.identificadorNoRascunho, (destino) => ({
    ...destino,
    itens: [...(destino.itens ?? []), item],
  }));
  return { ...exigencias, regrasDeComprovacao };
}

function podeIncluir(
  exigencias: ExigenciasDoRascunho,
  grupo: RegraDeComprovacao,
  item: RegraDeComprovacao,
): boolean {
  return (
    item !== grupo &&
    encontrarGrupo([item], grupo.identificadorNoRascunho) === undefined &&
    mesmoMomento([grupo, item]) &&
    documentosDe([item]).every(
      (documento) => !exigencias.emTodasAsFases.includes(documento.tipoDocumentoId),
    )
  );
}

function semItem(grupo: RegraDeComprovacao, item: RegraDeComprovacao): RegraDeComprovacao {
  const itens = (grupo.itens ?? []).filter((regra) => regra !== item);
  const quantidadeMinima =
    grupo.quantidadeMinima === null ? null : Math.min(grupo.quantidadeMinima, itens.length);
  return { ...grupo, itens, quantidadeMinima };
}

export function retirarDoGrupo(
  exigencias: ExigenciasDoRascunho,
  identificadorDoGrupo: string,
  identificadorDoItem: string,
): ExigenciasDoRascunho {
  const grupo = encontrarGrupo(exigencias.regrasDeComprovacao, identificadorDoGrupo);
  const item = grupo?.itens?.find((regra) => regra.identificadorNoRascunho === identificadorDoItem);
  if (grupo === undefined || item === undefined || (grupo.itens?.length ?? 0) <= 1)
    return exigencias;
  const regras = alterarGrupo(exigencias.regrasDeComprovacao, identificadorDoGrupo, (atual) =>
    semItem(atual, item),
  );
  return { ...exigencias, regrasDeComprovacao: [...regras, item] };
}
