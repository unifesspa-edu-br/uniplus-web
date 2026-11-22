import type { ItemDeComprovacao } from './regras-de-documentos';
import type { DocumentoAvaliado, GrupoDoDocumento } from './documentos-avaliados';
import type { GrupoRenderizavel } from './formulario-do-candidato.model';
import { textoDoGrupo } from './textos-das-regras-de-documentos';

const DOCUMENTO_PADRAO = {
  obrigatorio: true,
  finalidade: 'INSCRICAO',
  formatos: { qualquer: true, lista: null },
  modelo: null,
  situacao: 'PENDENTE',
  grupoCodigo: null,
  ocorrenciaId: null,
  grupos: [],
  grupoDoFormularioParaRepeticao: null,
  formatosAceitos: ['PDF'],
  tamanhoMaximoBytes: 2 * 1024 * 1024,
  quantidadeMinima: 1,
  arquivos: [],
} satisfies Omit<DocumentoAvaliado, 'exigenciaId' | 'nome'>;

export const documento = (
  nome: string,
  outros: Partial<DocumentoAvaliado> = {},
): DocumentoAvaliado => ({
  exigenciaId: `exigencia-${nome}`,
  nome,
  ...DOCUMENTO_PADRAO,
  ...outros,
});
export const ou = (
  grupoId: string,
  minimo: number | null = 1,
  grupoDoFormularioParaRepeticao: string | null = null,
): GrupoDoDocumento => ({
  grupoId,
  forma: { codigo: 'QUANTIDADE_MINIMA_DE_ITENS', rotulo: 'Quantidade mínima' },
  minimo,
  grupoDoFormularioParaRepeticao,
});
export const e = (grupoId: string): GrupoDoDocumento => ({
  grupoId,
  forma: { codigo: 'TODOS_OS_ITENS', rotulo: 'Todos estes itens' },
  minimo: null,
  grupoDoFormularioParaRepeticao: null,
});

export const FAMILIA: GrupoRenderizavel = {
  codigo: 'FAMILIA',
  ordem: 0,
  rotulo: 'Composição familiar',
  ocorrencias: { minimo: 1, incluiCandidato: true },
  subitens: [],
};
export const CANDIDATO = { id: 'o1', respostas: { PARENTESCO: 'PROPRIO_CANDIDATO' } };
export const MAE = { id: 'o2', respostas: { PARENTESCO: 'MAE' } };
export const PAI = { id: 'o3', respostas: { PARENTESCO: 'PAI' } };

/** O documento que se repete por integrante a partir da própria regra de documento, sob um grupo de alternativas escolhido uma vez. */
export const documentoRepetido = (nome: string, ocorrenciaId: string, situacao = 'PENDENTE') =>
  documento(nome, {
    grupoCodigo: 'FAMILIA',
    ocorrenciaId,
    grupoDoFormularioParaRepeticao: 'FAMILIA',
    situacao,
    grupos: [ou('b1')],
  });

/** A estrutura de regras como texto: o grupo pelo que diz ao candidato, o documento pelo nome. */
export const comoTexto = (elementos: readonly ItemDeComprovacao[]): unknown[] =>
  elementos.map((elemento) =>
    elemento.forma === 'DOCUMENTO'
      ? elemento.documento.rotulo
      : { [textoDoGrupo(elemento)]: comoTexto(elemento.itens) },
  );
