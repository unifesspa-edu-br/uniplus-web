import {
  TipoDeDecisaoDoDocumento as Tipo,
  AreaDoEnemDoProcedimento as Area,
  type DocumentoDaConfiguracaoProcedimentoDeRecurso,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { alvosOferecidos, linhasDoTipo, tiposNaTela } from './procedimentos-na-tela';
import { procedimentoDoDocumento as procedimento } from './procedimentos.testing';

const ITEM_1 = { itemDeAvaliacaoChave: 'item-1' };
const AREA = { areaDoEnem: Area.MATEMATICA };
const OFERECIDOS = [
  { alvo: ITEM_1, rotulo: 'Coerência' },
  { alvo: AREA, rotulo: 'Matemática' },
];
const daNota = (parcial = {}) => procedimento({ tipoDeDecisao: Tipo.NOTA_DA_ETAPA, ...parcial });
const tipoDaNota = (
  procedimentos: readonly DocumentoDaConfiguracaoProcedimentoDeRecurso[] = [daNota()],
  declarado = true,
) => ({
  tipoDeDecisao: Tipo.NOTA_DA_ETAPA,
  rotulo: 'Nota da etapa',
  declarado,
  procedimentos,
});

describe('alvosOferecidos', () => {
  it('oferece os itens já numerados pelo nome e depois as áreas do ENEM', () => {
    const itens = [
      { chave: 'item-1', rotulo: 'Coerência', pontuacaoMaxima: 5 },
      { chave: 'novo', rotulo: 'Novo', pontuacaoMaxima: 5 },
      { chave: 'item-2', rotulo: '', pontuacaoMaxima: 5 },
    ];

    expect(alvosOferecidos(itens, [Area.MATEMATICA])).toEqual([
      { alvo: ITEM_1, rotulo: 'Coerência' },
      { alvo: { itemDeAvaliacaoChave: 'novo' }, rotulo: 'Novo' },
      { alvo: { itemDeAvaliacaoChave: 'item-2' }, rotulo: 'Item sem nome' },
      { alvo: AREA, rotulo: 'Matemática' },
    ]);
  });
});

describe('tiposNaTela', () => {
  it('põe os tipos declarados primeiro, sem repetir, e depois os que só têm procedimento', () => {
    const procedimentos = [
      procedimento({ tipoDeDecisao: Tipo.CLASSIFICACAO }),
      daNota(),
      procedimento({ tipoDeDecisao: Tipo.CLASSIFICACAO, alvo: AREA }),
    ];

    const tipos = tiposNaTela(procedimentos, [
      Tipo.NOTA_DA_ETAPA,
      Tipo.GABARITO_DA_PROVA,
      Tipo.NOTA_DA_ETAPA,
    ]);

    expect(tipos.map(({ tipoDeDecisao, declarado }) => [tipoDeDecisao, declarado])).toEqual([
      [Tipo.NOTA_DA_ETAPA, true],
      [Tipo.GABARITO_DA_PROVA, true],
      ['CLASSIFICACAO', false],
    ]);
    expect(tipos[0].rotulo).toBe('Nota da etapa');
    expect(tipos[2].procedimentos).toHaveLength(2);
  });
});

describe('linhasDoTipo', () => {
  it('não confunde ocorrência com pontuação presente na chave local', () => {
    const itemComDoisPontos = { itemDeAvaliacaoChave: 'item-1:1' };
    const oferecidos = [...OFERECIDOS, { alvo: itemComDoisPontos, rotulo: 'Outro' }];
    const linhas = linhasDoTipo(
      tipoDaNota([daNota({ alvo: ITEM_1 }), daNota({ alvo: ITEM_1 })]),
      'porAlvo',
      oferecidos,
    );
    expect(new Set(linhas.map((linha) => linha.chave)).size).toBe(linhas.length);
  });

  it('mantém cada duplicata importada com chave de linha e ocorrência próprias', () => {
    const duplicada = daNota({ alvo: ITEM_1 });
    const linhas = linhasDoTipo(
      tipoDaNota([duplicada, duplicada, duplicada]),
      'porAlvo',
      OFERECIDOS,
    );
    const doItem = linhas.filter((linha) => linha.alvo === ITEM_1 || linha.declarado === duplicada);
    expect(doItem.map((linha) => linha.ocorrencia)).toEqual([0, 1, 2]);
    expect(new Set(linhas.map((linha) => linha.chave)).size).toBe(linhas.length);
  });

  it('identifica o mesmo alvo por chave depois de renomear e reordenar os itens', () => {
    const procedimentos = [daNota({ alvo: ITEM_1 })];
    const oferecidos = alvosOferecidos(
      [
        { chave: 'segundo', rotulo: 'Segundo' },
        { chave: 'item-1', rotulo: 'Novo nome' },
      ],
      [],
    );
    const linhas = linhasDoTipo(tipoDaNota(procedimentos), 'porAlvo', oferecidos);
    expect(linhas[1].rotulo).toBe('Novo nome');
    expect(linhas[1].declarado).toBe(procedimentos[0]);
  });

  it('não oferece item importado com chave vazia', () => {
    expect(alvosOferecidos([{ chave: '', rotulo: 'Inválido' }], [])).toEqual([]);
  });

  it('dá uma linha só à decisão inteira, com o procedimento declarado dela', () => {
    const [linha, ...demais] = linhasDoTipo(tipoDaNota(), 'tipoInteiro', OFERECIDOS);

    expect(demais).toEqual([]);
    expect(linha).toMatchObject({ alvo: null, rotulo: 'Procedimento de recurso' });
    expect(linha.declarado).not.toBeNull();
    expect(linha.soRemove).toBe(false);
  });

  it('dá uma linha a cada alvo oferecido, declarada só a que tem procedimento', () => {
    const linhas = linhasDoTipo(tipoDaNota([daNota({ alvo: AREA })]), 'porAlvo', OFERECIDOS);

    expect(linhas.map((linha) => [linha.rotulo, linha.declarado !== null])).toEqual([
      ['Coerência', false],
      ['Matemática', true],
    ]);
  });

  it('mantém numa linha de sobra o procedimento que nenhuma linha oferecida cobre', () => {
    const perdido = { itemDeAvaliacaoChave: 'item-3' };

    const linhas = linhasDoTipo(tipoDaNota([daNota({ alvo: perdido })]), 'porAlvo', OFERECIDOS);

    expect(linhas.at(-1)).toMatchObject({
      alvo: perdido,
      rotulo: 'Item que a etapa não tem mais',
      foraDoOferecido: true,
      soRemove: true,
    });
  });

  it('dá à sobra o nome do alvo oferecido quando o modo é que não combina', () => {
    const linhas = linhasDoTipo(tipoDaNota([daNota({ alvo: ITEM_1 })]), 'tipoInteiro', OFERECIDOS);

    expect(linhas.map((linha) => linha.rotulo)).toEqual(['Procedimento de recurso', 'Coerência']);
  });

  it('só mostra o que foi declarado quando o lugar deixou de declarar o tipo', () => {
    const tipo = tipoDaNota([daNota()], false);

    const linhas = linhasDoTipo(tipo, 'tipoInteiro', OFERECIDOS);

    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ foraDoOferecido: false, soRemove: true });
  });
});
