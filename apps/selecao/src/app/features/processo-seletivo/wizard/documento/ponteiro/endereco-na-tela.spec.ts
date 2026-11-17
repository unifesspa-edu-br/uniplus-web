import { describe, expect, it } from 'vitest';

import { enderecoNaTela } from './endereco-na-tela';

const FORA = { resolvido: false, motivo: 'foraDoDocumento' };

function umDocumentoEnviado(): Record<string, unknown> {
  return {
    nome: 'Seleção fictícia de teste',
    fases: [
      {
        chave: 'fase-inscricao',
        regraRecurso: {
          procedimentos: [{ chave: 'procedimento-analise', regra: 'a' }, { regra: 'b' }],
        },
      },
      { chave: 'fase-prova', etapas: [{ rotulo: 'sem chave' }, { chave: 'etapa-redacao' }] },
      { codigo: 'fase-sem-chave' },
    ],
    'a/b': { 'c~d': 1 },
    nulo: null,
    texto: 'abc',
    lista: [7, null, ['x']],
  };
}

function caminhoDe(documento: unknown, ponteiro: string): unknown {
  const resultado = enderecoNaTela(documento, ponteiro);
  return resultado.resolvido ? resultado.endereco.caminho : resultado;
}

describe('enderecoNaTela', () => {
  it('resolve a raiz com o caminho vazio', () => {
    expect(caminhoDe(umDocumentoEnviado(), '')).toEqual([]);
  });

  it('mantém o nome do campo de objeto', () => {
    expect(caminhoDe(umDocumentoEnviado(), '/nome')).toEqual(['nome']);
  });

  it('troca a posição pela chave do item da lista', () => {
    expect(caminhoDe(umDocumentoEnviado(), '/fases/1')).toEqual(['fases', { chave: 'fase-prova' }]);
  });

  it('mantém a posição quando o item da lista não tem chave', () => {
    expect(caminhoDe(umDocumentoEnviado(), '/fases/2')).toEqual(['fases', 2]);
  });

  it('mantém a posição do item que é objeto com outra propriedade', () => {
    expect(caminhoDe(umDocumentoEnviado(), '/fases/1/etapas/0')).toEqual([
      'fases',
      { chave: 'fase-prova' },
      'etapas',
      0,
    ]);
  });

  it('mantém a posição do item que não é objeto', () => {
    expect(caminhoDe(umDocumentoEnviado(), '/lista/0')).toEqual(['lista', 0]);
    expect(caminhoDe(umDocumentoEnviado(), '/lista/1')).toEqual(['lista', 1]);
    expect(caminhoDe(umDocumentoEnviado(), '/lista/2')).toEqual(['lista', 2]);
  });

  it('resolve o objeto aninhado, com chave nas listas e posição onde falta', () => {
    expect(caminhoDe(umDocumentoEnviado(), '/fases/0/regraRecurso/procedimentos/1/regra')).toEqual([
      'fases',
      { chave: 'fase-inscricao' },
      'regraRecurso',
      'procedimentos',
      1,
      'regra',
    ]);
  });

  it('resolve o item com chave dentro do objeto aninhado', () => {
    expect(caminhoDe(umDocumentoEnviado(), '/fases/0/regraRecurso/procedimentos/0/regra')).toEqual([
      'fases',
      { chave: 'fase-inscricao' },
      'regraRecurso',
      'procedimentos',
      { chave: 'procedimento-analise' },
      'regra',
    ]);
  });

  it('guarda a chave do item apontado, que sobrevive à reordenação feita depois do envio', () => {
    const enviado = umDocumentoEnviado();
    const aposReordenar = { ...enviado, fases: [...(enviado['fases'] as unknown[])].reverse() };

    expect(caminhoDe(enviado, '/fases/0')).toEqual(['fases', { chave: 'fase-inscricao' }]);
    expect(caminhoDe(aposReordenar, '/fases/0')).toEqual(['fases', 0]);
  });

  it('aceita chave e nome de campo com barra e til escapados no ponteiro', () => {
    expect(caminhoDe(umDocumentoEnviado(), '/a~1b/c~0d')).toEqual(['a/b', 'c~d']);
  });

  it('aceita chave com caracteres especiais sem alterá-la', () => {
    const documento = { itens: [{ chave: 'fase/~1 ação "é" ñ' }] };

    expect(caminhoDe(documento, '/itens/0')).toEqual(['itens', { chave: 'fase/~1 ação "é" ñ' }]);
  });

  it('declara fora do documento a posição além do fim da lista', () => {
    expect(enderecoNaTela(umDocumentoEnviado(), '/fases/3')).toEqual(FORA);
  });

  it.each(['/fases/-1', '/fases/01', '/fases/1.0', '/fases/um', '/fases/', '/fases/-'])(
    'declara fora do documento o segmento %s que não é posição de lista',
    (ponteiro) => {
      expect(enderecoNaTela(umDocumentoEnviado(), ponteiro)).toEqual(FORA);
    },
  );

  it('declara fora do documento o campo que o objeto não tem', () => {
    expect(enderecoNaTela(umDocumentoEnviado(), '/fases/0/inexistente')).toEqual(FORA);
  });

  it('declara fora do documento o caminho que passa por valor primitivo', () => {
    expect(enderecoNaTela(umDocumentoEnviado(), '/texto/0')).toEqual(FORA);
    expect(enderecoNaTela(umDocumentoEnviado(), '/lista/0/campo')).toEqual(FORA);
  });

  it('declara fora do documento o caminho que passa por nulo', () => {
    expect(enderecoNaTela(umDocumentoEnviado(), '/nulo/campo')).toEqual(FORA);
    expect(enderecoNaTela(umDocumentoEnviado(), '/lista/1/campo')).toEqual(FORA);
  });

  it('declara fora do documento o caminho que passa por lista com nome de campo', () => {
    expect(enderecoNaTela(umDocumentoEnviado(), '/fases/length')).toEqual(FORA);
  });

  it('declara fora do documento quando o documento enviado é primitivo', () => {
    expect(enderecoNaTela('texto', '/campo')).toEqual(FORA);
    expect(enderecoNaTela(null, '/campo')).toEqual(FORA);
    expect(enderecoNaTela(undefined, '/campo')).toEqual(FORA);
  });

  it('não alcança o protótipo por __proto__, constructor ou toString', () => {
    const documento = umDocumentoEnviado();

    expect(enderecoNaTela(documento, '/__proto__')).toEqual(FORA);
    expect(enderecoNaTela(documento, '/constructor')).toEqual(FORA);
    expect(enderecoNaTela(documento, '/constructor/name')).toEqual(FORA);
    expect(enderecoNaTela(documento, '/fases/0/__proto__/toString')).toEqual(FORA);
    expect(enderecoNaTela(documento, '/toString')).toEqual(FORA);
  });

  it('lê __proto__ como campo comum quando o documento o traz como propriedade própria', () => {
    const documento: unknown = JSON.parse('{"__proto__":{"chave":"x"},"constructor":1}');

    expect(caminhoDe(documento, '/__proto__')).toEqual(['__proto__']);
    expect(caminhoDe(documento, '/constructor')).toEqual(['constructor']);
  });

  it('não toma como identidade a chave herdada do item', () => {
    const herdado = Object.create({ chave: 'herdada' }) as object;

    expect(caminhoDe({ itens: [herdado] }, '/itens/0')).toEqual(['itens', 0]);
  });

  it('mantém a posição quando a chave do item não é texto', () => {
    expect(caminhoDe({ itens: [{ chave: 7 }] }, '/itens/0')).toEqual(['itens', 0]);
  });

  it('declara fora do documento a posição de lista esparsa ou herdada', () => {
    const esparsa = [undefined, 'b'];
    delete esparsa[0];
    Object.setPrototypeOf(esparsa, { 0: 'herdado', 5: 'herdado' });

    expect(enderecoNaTela({ itens: esparsa }, '/itens/0')).toEqual(FORA);
    expect(enderecoNaTela({ itens: esparsa }, '/itens/5')).toEqual(FORA);
  });

  it('resolve o campo próprio de nome vazio', () => {
    expect(caminhoDe({ '': { a: 1 } }, '//a')).toEqual(['', 'a']);
  });

  it('declara ponteiro inválido sem consultar o documento', () => {
    const invalido = { resolvido: false, motivo: 'ponteiroInvalido' };

    expect(enderecoNaTela(umDocumentoEnviado(), 'fases/0')).toEqual(invalido);
    expect(enderecoNaTela(umDocumentoEnviado(), '/fases/~2')).toEqual(invalido);
  });

  it('não altera o documento enviado', () => {
    const documento = umDocumentoEnviado();
    const copia = structuredClone(documento);

    enderecoNaTela(documento, '/fases/0/regraRecurso/procedimentos/1/regra');
    enderecoNaTela(documento, '/fases/9');

    expect(documento).toEqual(copia);
  });
});
