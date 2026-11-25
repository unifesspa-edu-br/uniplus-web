import { resolve } from 'node:path';
import postcss from 'postcss';
import { declaracoesDaRegra, lerFolhaDeEstilo, valoresNosTemas } from './folha-de-estilo.testing';

describe('leitura de folha de estilo', () => {
  const folha = lerFolhaDeEstilo(resolve(__dirname, 'folha-exemplo.css'));

  it('insere a importação na posição original e ignora comentários nas declarações', () => {
    expect(folha.nodes.map((no) => no.type)).toEqual([
      'atrule',
      'rule',
      'comment',
      'rule',
      'rule',
      'atrule',
      'rule',
    ]);
    expect(folha.first?.type).toBe('atrule');
    expect(folha.first?.toString()).toBe("@import 'pacote'");
    expect(folha.nodes[1].toString()).toBe('.exemplo {\n  color: red;\n}');
  });

  it('considera a ordem das declarações e ignora comentários', () => {
    expect(declaracoesDaRegra(folha, '.exemplo').get('color')).toBe('green');
    expect(declaracoesDaRegra(folha, '.outra').get('font-weight')).toBe('normal');
  });

  it('preserva a prioridade important nas declarações', () => {
    const folhaComPrioridade = postcss.parse('.outra { font-weight: normal !important; }');
    expect(declaracoesDaRegra(folhaComPrioridade, '.outra').get('font-weight')).toBe(
      'normal !important',
    );
  });

  it('distingue regras da raiz e da impressão', () => {
    expect(declaracoesDaRegra(folha, '.exemplo', 'print').get('color')).toBe('black');
    expect(declaracoesDaRegra(folha, '.outra', 'print').size).toBe(0);
  });

  it('resolve variáveis encadeadas e valores dos dois temas', () => {
    expect(valoresNosTemas(folha, 'var(--um)')).toEqual(['#ffffff', '#111111']);
    expect(valoresNosTemas(folha, '1rem')).toEqual(['1rem', '1rem']);
  });
});
