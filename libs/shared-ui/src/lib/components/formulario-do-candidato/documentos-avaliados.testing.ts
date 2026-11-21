import type { NoDeDocumentos } from './arvore-de-documentos';
import type { DocumentoAvaliado, GrupoDoDocumento } from './documentos-avaliados';
import type { GrupoRenderizavel } from './formulario-do-candidato.model';
import { textoDoGrupo } from './textos-da-arvore-de-documentos';

const DOCUMENTO_PADRAO = {
  obrigatorio: true,
  finalidade: 'INSCRICAO',
  formatos: { qualquer: true, lista: null },
  modelo: null,
  situacao: 'PENDENTE',
  grupoCodigo: null,
  ocorrenciaId: null,
  grupos: [],
  repetePorEntidade: null,
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
  repetePorEntidade: string | null = null,
): GrupoDoDocumento => ({ grupoId, tipo: 'OU', minimo, repetePorEntidade });
export const e = (grupoId: string): GrupoDoDocumento => ({
  grupoId,
  tipo: 'E',
  minimo: null,
  repetePorEntidade: null,
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

/** O documento que se repete por integrante a partir da própria folha, sob um OU escolhido uma vez. */
export const folhaRepetida = (nome: string, ocorrenciaId: string, situacao = 'PENDENTE') =>
  documento(nome, {
    grupoCodigo: 'FAMILIA',
    ocorrenciaId,
    repetePorEntidade: 'FAMILIA',
    situacao,
    grupos: [ou('b1')],
  });

/** A árvore como texto: o grupo pelo que diz ao candidato, o documento pelo nome. */
export const comoTexto = (nos: readonly NoDeDocumentos[]): unknown[] =>
  nos.map((no) =>
    no.tipo === 'DOCUMENTO' ? no.documento.rotulo : { [textoDoGrupo(no)]: comoTexto(no.itens) },
  );
