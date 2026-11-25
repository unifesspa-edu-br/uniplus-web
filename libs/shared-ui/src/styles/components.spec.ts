import { resolve } from 'node:path';
import { declaracoesDaRegra, lerFolhaDeEstilo, valoresNosTemas } from '@uniplus/shared-testing';
import { razaoDeContraste } from './testing/contraste.testing';

describe('folha de estilo compartilhada', () => {
  const componentes = lerFolhaDeEstilo(resolve(__dirname, 'components.css'));
  const tokens = lerFolhaDeEstilo(resolve(__dirname, 'tokens.css'));

  it('o título dos filtros tem ao menos 14 pixels nos dois temas', () => {
    const valor = declaracoesDaRegra(componentes, '.filter-bar__titulo').get('font-size') ?? '';
    for (const tamanho of valoresNosTemas(tokens, valor)) {
      expect(tamanho.endsWith('rem')).toBe(true);
      expect(Number.parseFloat(tamanho)).toBeGreaterThanOrEqual(0.875);
    }
  });

  it('o erro na sobreposição tem contraste de ao menos 3:1 nos dois temas', () => {
    const valor =
      declaracoesDaRegra(componentes, '.ui-steps--sobreposicao').get('--ui-steps-erro') ?? '';
    expect(valor).toMatch(/^var\(--[\w-]+\)$/u);
    const erro = valoresNosTemas(tokens, valor);
    const fundo = valoresNosTemas(tokens, 'var(--surface-inverse)');
    for (const indice of [0, 1] as const)
      expect(razaoDeContraste(erro[indice], fundo[indice])).toBeGreaterThanOrEqual(3);
  });

  it('o nome da linha clicável é sublinhado sob o ponteiro', () => {
    expect(declaracoesDaRegra(componentes, '.table-responsive__alvo').get('text-decoration')).toBe(
      'none',
    );
    for (const seletor of [
      '.table-responsive tbody tr:hover .table-responsive__alvo',
      '.table-responsive__alvo:hover',
    ]) {
      expect(declaracoesDaRegra(componentes, seletor).get('text-decoration')).toBe('underline');
    }
  });
});
