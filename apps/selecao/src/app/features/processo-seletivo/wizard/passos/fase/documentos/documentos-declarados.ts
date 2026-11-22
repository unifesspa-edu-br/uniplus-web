import type {
  DocumentoDefinicao,
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
} from '../../../processo-seletivo.models';
import {
  exigenciasDaFase,
  exigenciasSemGrupo,
  todasAsExigencias,
} from '../../../shared/exigencias/consulta-das-exigencias';

export function documentosDeclarados(
  faseCodigo: string,
  exigencias: ExigenciasDoRascunho,
  catalogo: readonly DocumentoDefinicao[],
): readonly DocumentoDefinicao[] {
  const declarados = tiposDeclarados(exigencias, faseCodigo);
  const doCatalogo = catalogo.filter((documento) => declarados.has(documento.id));
  const visiveis = new Set(doCatalogo.map((documento) => documento.id));
  const foraDoCadastro = [...declarados]
    .filter((id) => !visiveis.has(id))
    .map((id) => documentoForaDoCadastro(id, exigencias));
  return [...doCatalogo, ...foraDoCadastro];
}

function tiposDeclarados(
  exigencias: ExigenciasDoRascunho,
  faseCodigo: string,
): ReadonlySet<string> {
  return new Set([
    ...exigenciasDaFase(exigencias, faseCodigo).map((item) => item.tipoDocumentoId),
    ...exigencias.emTodasAsFases,
  ]);
}

function documentoForaDoCadastro(id: string, exigencias: ExigenciasDoRascunho): DocumentoDefinicao {
  const declarada = todasAsExigencias(exigencias).find((item) => item.tipoDocumentoId === id);
  const situacao =
    'Este tipo saiu do cadastro depois de ser exigido aqui. Continua valendo enquanto estiver na lista.';
  return {
    id,
    nome: declarada?.tipoDocumentoNome ?? 'Documento fora do cadastro ativo',
    descricao: null,
    formatos: null,
    orientacao: `${situacao} Remova-o se não for mais pedido.`,
    situacao,
  };
}

export function modeloParaTodasAsFases(
  exigencias: ExigenciasDoRascunho,
  id: string,
): ExigenciaDeDocumento | undefined {
  return exigencias.emTodasAsFases.includes(id)
    ? exigenciasSemGrupo(exigencias).find((exigencia) => exigencia.tipoDocumentoId === id)
    : undefined;
}
