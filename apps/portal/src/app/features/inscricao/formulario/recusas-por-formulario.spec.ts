import { describe, expect, it } from 'vitest';

import { DOIS_FORMULARIOS, TERMO_ACADEMICO } from './formularios-da-inscricao.testing';
import { recusasPorFormulario } from './recusas-por-formulario';

const DOCUMENTO = { exigenciaId: 'exigencia-1', nome: 'Histórico escolar' };
const REFERENCIAS = {
  formularios: DOIS_FORMULARIOS,
  documentos: [
    { ...DOCUMENTO, formularioCodigo: 'DADOS_ACADEMICOS' },
    { exigenciaId: 'exigencia-2', nome: 'Documento solto', formularioCodigo: null },
  ],
};
const recusa = (campo: string) => ({ campo, mensagem: `Recusa de ${campo}.` });

describe('recusasPorFormulario', () => {
  it('liga o dado ao formulário que o coleta e dá o rótulo dele', () => {
    const { itens } = recusasPorFormulario(
      [recusa('INSTITUICAO_DE_ORIGEM'), recusa('NOME')],
      REFERENCIAS,
    );

    expect(itens.map((i) => [i.formularioCodigo, i.rotulo])).toEqual([
      ['DADOS_ACADEMICOS', 'Instituição de origem'],
      ['INSCRICAO', 'Nome completo'],
    ]);
  });

  it('liga o termo pelo código dele nas regras, que traz o formulário', () => {
    const { itens } = recusasPorFormulario([recusa(TERMO_ACADEMICO)], REFERENCIAS);

    expect(itens[0]).toMatchObject({
      formularioCodigo: 'DADOS_ACADEMICOS',
      rotulo: 'Declaração de veracidade',
    });
  });

  it('liga o documento ao formulário da exigência na avaliação, com o nome dela', () => {
    const { itens } = recusasPorFormulario(
      [recusa('documentos.exigencia-1.ocorrencia-1')],
      REFERENCIAS,
    );

    expect(itens[0]).toMatchObject({
      formularioCodigo: 'DADOS_ACADEMICOS',
      rotulo: 'Histórico escolar',
    });
  });

  it('a recusa que não se localiza fica no primeiro formulário, sem rótulo', () => {
    const { itens } = recusasPorFormulario(
      [recusa('CAMPO_DESCONHECIDO'), recusa('documentos.exigencia-2'), recusa('documentos.outra')],
      REFERENCIAS,
    );

    expect(itens.map((i) => [i.formularioCodigo, i.rotulo])).toEqual([
      ['INSCRICAO', null],
      ['INSCRICAO', null],
      ['INSCRICAO', null],
    ]);
  });

  it('o formulário da primeira recusa, na ordem da API, é o que a tela abre', () => {
    const recusas = recusasPorFormulario(
      [recusa('INSTITUICAO_DE_ORIGEM'), recusa('NOME')],
      REFERENCIAS,
    );

    expect(recusas.primeiro).toBe('DADOS_ACADEMICOS');
    expect([...recusas.porFormulario.keys()]).toEqual(['DADOS_ACADEMICOS', 'INSCRICAO']);
    expect(recusas.porFormulario.get('INSCRICAO')).toEqual([recusa('NOME')]);
  });

  it('sem recusa, nenhum formulário é indicado', () => {
    expect(recusasPorFormulario([], REFERENCIAS)).toMatchObject({ primeiro: null, itens: [] });
  });
});
