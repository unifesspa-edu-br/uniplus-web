import { resolve } from 'node:path';
import { declaracoesDaRegra, lerFolhaDeEstilo } from '@uniplus/shared-testing';

describe('folha de estilo base — impressão', () => {
  const folha = lerFolhaDeEstilo(resolve(__dirname, 'base.css'));

  it('oculta no papel o conteúdo exclusivo da tela', () => {
    folha.walkRules((regra) => {
      if (!regra.selectors.some((seletor) => /\.u-no-print(?![\w-])/u.test(seletor))) return;
      expect(regra.parent?.type).toBe('atrule');
      expect(regra.parent?.type === 'atrule' && regra.parent.name).toBe('media');
      expect(regra.parent?.type === 'atrule' && regra.parent.params).toBe('print');
      expect(regra.parent?.parent?.type).toBe('root');
    });
    expect(declaracoesDaRegra(folha, '.u-no-print', 'print').get('display')).toBe(
      'none !important',
    );
  });

  it('mostra o conteúdo exclusivo do papel somente na impressão', () => {
    expect(declaracoesDaRegra(folha, '.u-print-only').get('display')).toBe('none !important');
    expect(declaracoesDaRegra(folha, '.u-print-only', 'print').get('display')).toBe(
      'revert !important',
    );
  });
});
