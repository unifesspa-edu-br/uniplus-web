import { describe, expect, it } from 'vitest';
import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { conteudoDoFormulario, edicaoDoConteudo } from '../adaptadores/formulario.adaptador';
import { documentoDoConteudo } from './conversao-do-formulario';
import { aceita, editar, formulario, CATALOGOS } from './conversao.testing';

function documento(): DocumentoDaConfiguracao {
  return { formato: 'uniplus.selecao.configuracao', versaoFormato: 1, formularios: [formulario()] };
}

describe('conteúdo do editor no adaptador do documento', () => {
  it('retorna ausente quando o código não tem formulário', () => {
    expect(conteudoDoFormulario(documento(), 'HABILITACAO', CATALOGOS)).toBeUndefined();
  });

  it('aplica somente os campos do conteúdo e conserva o cabeçalho vigente', () => {
    const original = documento();
    const conversao = editar(formulario(), (conteudo) => ({ ...conteudo, titulo: 'Cadastro' }));
    const atual = { ...original, formularios: [{ ...formulario(), faseChave: 'fase-atual' }] };
    const novo = edicaoDoConteudo('INSCRICAO', conversao)(atual);
    expect(novo.formularios?.[0]).toMatchObject({
      titulo: 'Cadastro',
      faseChave: 'fase-atual',
      modeloOrigemCodigo: 'MODELO',
    });
    expect(novo.formularios?.[0].itens).toBe(atual.formularios[0].itens);
  });

  it('o resultado acompanha as confirmações feitas antes da última edição', () => {
    const primeiro = aceita(
      editar(formulario(), (conteudo) => conteudo, [
        ['grupos', 'familia', 'ocorrencias', 'minimo'],
      ]),
    );
    const segundo = documentoDoConteudo(
      primeiro,
      { conteudo: { ...primeiro.conteudo, titulo: 'Cadastro' }, camposEditados: [['titulo']] },
      CATALOGOS,
    );
    const novo = edicaoDoConteudo('INSCRICAO', segundo)(documento());
    expect(novo.formularios?.[0].grupos?.[0]).toHaveProperty('minimo', 0);
    expect(novo.formularios?.[0].grupos?.[0]).not.toHaveProperty('incluiCandidato');
  });

  it('o formulário do código recebe o conteúdo sem substituir os outros', () => {
    const original = {
      ...documento(),
      formularios: [formulario(), { ...formulario(), codigo: 'ISENCAO_TAXA', titulo: 'Segundo' }],
    };
    const atual = conteudoDoFormulario(original, 'ISENCAO_TAXA', CATALOGOS);
    expect(atual?.ok).toBe(true);
    if (atual === undefined || !atual.ok) return;
    const conversao = documentoDoConteudo(
      atual,
      { conteudo: { ...atual.conteudo, titulo: 'Cadastro' }, camposEditados: [['titulo']] },
      CATALOGOS,
    );
    const novo = edicaoDoConteudo('ISENCAO_TAXA', conversao)(original);
    expect(novo.formularios?.[0]).toBe(original.formularios[0]);
    expect(novo.formularios?.[1].titulo).toBe('Cadastro');
  });
});
