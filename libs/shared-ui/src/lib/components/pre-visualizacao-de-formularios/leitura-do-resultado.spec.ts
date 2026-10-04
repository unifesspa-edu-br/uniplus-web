import { describe, expect, it } from 'vitest';
import { documentosPorFase, letrasDasAlternativas, resumoDaPreVisualizacao, textoDasAlternativas } from './leitura-do-resultado';
import type { DocumentoAvaliado, GrupoAvaliado } from './pre-visualizacao-de-formularios';

const GRUPO: GrupoAvaliado = {
  codigo: 'MEMBROS',
  etapaCodigo: 'S1',
  visivel: 'VERDADEIRO',
  obrigatorio: 'VERDADEIRO',
  contagemValida: true,
  ocorrenciaDoCandidatoValida: true,
  ocorrencias: [],
};

const DOCUMENTO: DocumentoAvaliado = {
  exigenciaId: 'e-1',
  nome: 'RG',
  obrigatorio: true,
  fase: { chave: 'INSCRICAO', nome: 'Inscrição', ordem: 1 },
  etapa: null,
  situacao: 'EXIGIDO',
  grupo: null,
  ocorrenciaId: null,
  alternativas: [],
};

describe('resumo da pré-visualização', () => {
  it('avisa o grupo cujas ocorrências a API não aceita como resposta, pela contagem que ela devolve', () => {
    const resumo = (grupo: GrupoAvaliado) =>
      resumoDaPreVisualizacao({ formularios: [{ finalidade: 'INSCRICAO', itens: [], termos: [], grupos: [grupo] }], documentos: null });

    expect(resumo(GRUPO)).not.toContain('não valem como resposta');
    expect(resumo({ ...GRUPO, contagemValida: false })).toContain('Em 1 grupo(s), as ocorrências simuladas não valem como resposta.');
  });

  it('conta os documentos exigidos e os a definir só quando há lista de documentos', () => {
    const documentos = [DOCUMENTO, { ...DOCUMENTO, situacao: 'INDETERMINADO' }, { ...DOCUMENTO, situacao: 'NAO_EXIGIDO' }];

    expect(resumoDaPreVisualizacao({ formularios: [], documentos })).toContain('1 documento(s) exigido(s), 1 a definir.');
    expect(resumoDaPreVisualizacao({ formularios: [], documentos: null })).not.toContain('documento');
  });
});

describe('documentos da pré-visualização', () => {
  it('agrupa os documentos por fase na ordem do cronograma, e não na ordem em que chegam', () => {
    const resultado = { ...DOCUMENTO, fase: { chave: 'RESULTADO', nome: 'Resultado', ordem: 5 } };
    const habilitacao = { ...DOCUMENTO, fase: { chave: 'HABILITACAO', nome: 'Habilitação', ordem: 3 } };

    expect(documentosPorFase([resultado, DOCUMENTO, habilitacao, DOCUMENTO]).map((fase) => [fase.chave, fase.documentos.length])).toEqual([
      ['INSCRICAO', 2],
      ['HABILITACAO', 1],
      ['RESULTADO', 1],
    ]);
  });

  it('o mesmo grupo de alternativas tem a mesma letra em documentos diferentes', () => {
    const rg = { ...DOCUMENTO, alternativas: [{ grupoId: 'g-identidade', minimo: 1 }] };
    const cnh = { ...DOCUMENTO, nome: 'CNH', alternativas: [{ grupoId: 'g-identidade', minimo: 1 }] };
    const letras = letrasDasAlternativas([DOCUMENTO, rg, cnh]);

    expect([DOCUMENTO, rg, cnh].map((documento) => textoDasAlternativas(documento, letras))).toEqual(['—', 'Grupo A (basta 1)', 'Grupo A (basta 1)']);
  });

  it('as alternativas aninhadas aparecem da mais externa à mais interna', () => {
    const aninhado = { ...DOCUMENTO, alternativas: [{ grupoId: 'g-externo', minimo: 1 }, { grupoId: 'g-interno', minimo: 2 }] };

    expect(textoDasAlternativas(aninhado, letrasDasAlternativas([aninhado]))).toBe('Grupo A (basta 1) › Grupo B (basta 2)');
  });
});
