import { describe, expect, it } from 'vitest';
import { resumoDaPreVisualizacao } from './leitura-do-resultado';
import type { GrupoAvaliado } from './pre-visualizacao-de-formularios';

const GRUPO: GrupoAvaliado = {
  codigo: 'MEMBROS',
  etapaCodigo: 'S1',
  visivel: 'VERDADEIRO',
  obrigatorio: 'VERDADEIRO',
  contagemValida: true,
  ocorrenciaDoCandidatoValida: true,
  ocorrencias: [],
};

describe('resumo da pré-visualização', () => {
  it('avisa o grupo cujas ocorrências a API não aceita como resposta, pela contagem que ela devolve', () => {
    const resumo = (grupo: GrupoAvaliado) => resumoDaPreVisualizacao([{ finalidade: 'INSCRICAO', itens: [], termos: [], grupos: [grupo] }]);

    expect(resumo(GRUPO)).not.toContain('não valem como resposta');
    expect(resumo({ ...GRUPO, contagemValida: false })).toContain('Em 1 grupo(s), as ocorrências simuladas não valem como resposta.');
  });
});
