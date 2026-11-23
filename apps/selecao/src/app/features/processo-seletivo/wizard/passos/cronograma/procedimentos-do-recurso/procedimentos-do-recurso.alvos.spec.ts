import { AreaDoEnemDoProcedimento as Area } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  assentar,
  atualizar,
  COLEGIADO,
  escolher,
  HOMOLOGACAO,
  MONOCRATICO,
  montarEdicao,
  NOTA,
  seletorDa,
  textoDe,
} from './procedimentos-do-recurso.edicao.testing';
import { procedimentoDoDocumento as procedimento } from './procedimentos.testing';

const ITENS = [
  { chave: 'item-1', rotulo: 'Coerência', pontuacaoMaxima: 5 },
  { chave: 'item-2', rotulo: 'Argumentação', pontuacaoMaxima: 5 },
];
const ITEM_1 = { itemDeAvaliacaoChave: 'item-1' };
const ITEM_2 = { itemDeAvaliacaoChave: 'item-2' };
const daNota = (parcial = {}) => procedimento({ tipoDeDecisao: NOTA, ...parcial });
const comItens = { tiposDeclarados: [NOTA], itensDaEtapa: ITENS };

const radios = (elementoDaTela: HTMLElement) =>
  Array.from(elementoDaTela.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
const rotulosDasLinhas = (elementoDaTela: HTMLElement) =>
  Array.from(elementoDaTela.querySelectorAll('sel-escolha-do-procedimento label'), (rotulo) =>
    rotulo.textContent?.trim(),
  );

describe('ProcedimentosDoRecursoComponent em edição: a decisão inteira ou por alvo', () => {
  it('não oferece a escolha de modo quando o lugar não tem alvo', async () => {
    const { elementoDaTela } = await montarEdicao();

    expect(radios(elementoDaTela)).toHaveLength(0);
    expect(rotulosDasLinhas(elementoDaTela)).toEqual(['Procedimento de recurso']);
  });

  it('oferece a decisão inteira ou um por item contestado, começando pela decisão inteira', async () => {
    const { elementoDaTela } = await montarEdicao(comItens);

    expect(radios(elementoDaTela).map((radio) => radio.value)).toEqual(['tipoInteiro', 'porAlvo']);
    expect(radios(elementoDaTela).map((radio) => radio.checked)).toEqual([true, false]);
    expect(rotulosDasLinhas(elementoDaTela)).toEqual(['Procedimento de recurso']);
  });

  it('pede a troca de modo e mostra uma linha por alvo oferecido', async () => {
    const { fixture, elementoDaTela, eventos } = await montarEdicao(comItens);

    radios(elementoDaTela)[1].click();
    await assentar(fixture);

    expect(eventos.trocarModo).toHaveBeenCalledExactlyOnceWith({
      tipoDeDecisao: NOTA,
      modo: 'porAlvo',
    });
    expect(rotulosDasLinhas(elementoDaTela)).toEqual(['Coerência', 'Argumentação']);
  });

  it('oferece as áreas do ENEM depois dos itens, cada uma na sua linha', async () => {
    const { fixture, elementoDaTela } = await montarEdicao({
      ...comItens,
      areasDoEnem: ['MATEMATICA', 'LINGUAGENS'],
    });

    radios(elementoDaTela)[1].click();
    await assentar(fixture);

    expect(rotulosDasLinhas(elementoDaTela)).toEqual([
      'Coerência',
      'Argumentação',
      'Matemática',
      'Linguagens',
    ]);
  });

  it('segue o modo dos procedimentos declarados, não a escolha anterior', async () => {
    const { elementoDaTela } = await montarEdicao({
      ...comItens,
      procedimentos: [daNota({ alvo: ITEM_1 })],
    });

    expect(radios(elementoDaTela).map((radio) => radio.checked)).toEqual([false, true]);
    expect(rotulosDasLinhas(elementoDaTela)).toEqual(['Coerência', 'Argumentação']);
  });

  it('devolve a escolha de modo ao que o documento guarda quando o pedido não é atendido', async () => {
    const { fixture, elementoDaTela } = await montarEdicao({
      ...comItens,
      procedimentos: [daNota({ alvo: ITEM_1 })],
    });

    radios(elementoDaTela)[0].click();
    await assentar(fixture);

    expect(radios(elementoDaTela).map((radio) => radio.checked)).toEqual([false, true]);
  });

  it('desabilita a escolha de modo quando a edição está bloqueada', async () => {
    const { elementoDaTela } = await montarEdicao({ ...comItens, modo: 'bloqueado' });

    expect(radios(elementoDaTela).every((radio) => radio.disabled)).toBe(true);
  });
});

describe('ProcedimentosDoRecursoComponent em edição: o modo quando os alvos mudam', () => {
  const porItem = { ...comItens, procedimentos: [daNota({ alvo: ITEM_1 })] };

  it('mantém a escolha de modo enquanto há procedimento por alvo, mesmo sem alvo oferecido', async () => {
    const { fixture, elementoDaTela, eventos } = await montarEdicao(porItem);

    await atualizar(fixture, { itensDaEtapa: [] });
    radios(elementoDaTela)[0].click();
    await assentar(fixture);

    expect(radios(elementoDaTela).map((radio) => radio.checked)).toEqual([false, true]);
    expect(rotulosDasLinhas(elementoDaTela)).toEqual(['Item que a etapa não tem mais']);
    expect(eventos.trocarModo).toHaveBeenCalledExactlyOnceWith({
      tipoDeDecisao: NOTA,
      modo: 'tipoInteiro',
    });
  });

  it('tira a escolha de modo quando não há mais alvo oferecido nem procedimento por alvo', async () => {
    const { fixture, elementoDaTela } = await montarEdicao(porItem);

    await atualizar(fixture, { itensDaEtapa: [], procedimentos: [] });

    expect(radios(elementoDaTela)).toHaveLength(0);
    expect(rotulosDasLinhas(elementoDaTela)).toEqual(['Procedimento de recurso']);
  });

  it('continua nos alvos ao remover o último procedimento por alvo', async () => {
    const { fixture, elementoDaTela } = await montarEdicao(porItem);

    await atualizar(fixture, { procedimentos: [] });

    expect(radios(elementoDaTela).map((radio) => radio.checked)).toEqual([false, true]);
    expect(rotulosDasLinhas(elementoDaTela)).toEqual(['Coerência', 'Argumentação']);
  });

  it('volta à decisão inteira, com o seletor, quando a escolha era por alvo e os alvos sumiram', async () => {
    const { fixture, elementoDaTela } = await montarEdicao(comItens);
    radios(elementoDaTela)[1].click();
    await assentar(fixture);

    await atualizar(fixture, { itensDaEtapa: [] });

    expect(radios(elementoDaTela)).toHaveLength(0);
    expect(rotulosDasLinhas(elementoDaTela)).toEqual(['Procedimento de recurso']);
    expect(seletorDa(elementoDaTela, NOTA, 0)).not.toBeNull();
  });
});

describe('ProcedimentosDoRecursoComponent em edição: uma linha por alvo', () => {
  const porItem = { ...comItens, procedimentos: [daNota({ alvo: ITEM_1 })] };

  it('declara o procedimento do alvo da linha, e não de outro', async () => {
    const { elementoDaTela, eventos } = await montarEdicao(porItem);

    escolher(seletorDa(elementoDaTela, NOTA, 1), MONOCRATICO);

    expect(eventos.declarar).toHaveBeenCalledExactlyOnceWith({
      identidade: { tipoDeDecisao: NOTA, alvo: ITEM_2 },
      regra: { codigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', versao: 'v1' },
    });
  });

  it('troca a regra só da linha que já tem procedimento', async () => {
    const { elementoDaTela, eventos } = await montarEdicao(porItem);

    escolher(seletorDa(elementoDaTela, NOTA, 0), MONOCRATICO);

    expect(eventos.trocarRegra).toHaveBeenCalledExactlyOnceWith({
      identidade: { tipoDeDecisao: NOTA, alvo: ITEM_1 },
      regra: { codigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', versao: 'v1' },
    });
  });

  it('declara por área do ENEM', async () => {
    const { elementoDaTela, eventos } = await montarEdicao({
      tiposDeclarados: [HOMOLOGACAO],
      areasDoEnem: ['MATEMATICA'],
      procedimentos: [
        procedimento({ tipoDeDecisao: HOMOLOGACAO, alvo: { areaDoEnem: Area.LINGUAGENS } }),
      ],
    });

    escolher(seletorDa(elementoDaTela, HOMOLOGACAO, 0), COLEGIADO);

    expect(eventos.declarar).toHaveBeenCalledExactlyOnceWith({
      identidade: { tipoDeDecisao: HOMOLOGACAO, alvo: { areaDoEnem: Area.MATEMATICA } },
      regra: { codigo: 'PROCEDIMENTO-RECURSO-COLEGIADO', versao: 'v1' },
    });
  });

  it('não exige procedimento para cada alvo quando o tipo já tem um', async () => {
    const { elementoDaTela } = await montarEdicao(porItem);

    expect(elementoDaTela.querySelectorAll('select')).toHaveLength(2);
    expect(textoDe(elementoDaTela)).not.toContain('Falta o procedimento');
  });

  it('avisa a falta no tipo, e não em cada alvo, enquanto nenhum alvo tem procedimento', async () => {
    const { fixture, elementoDaTela } = await montarEdicao({
      ...comItens,
      procedimentos: [daNota({ alvo: ITEM_1 })],
    });

    await atualizar(fixture, { procedimentos: [] });
    radios(elementoDaTela)[1].click();
    await assentar(fixture);

    expect(elementoDaTela.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(textoDe(elementoDaTela)).toContain(
      'Falta o procedimento de recurso para “Nota da etapa”',
    );
  });

  it('mantém a linha do alvo que a etapa deixou de oferecer, com aviso e remoção', async () => {
    const { elementoDaTela, eventos } = await montarEdicao({
      ...porItem,
      procedimentos: [
        daNota({ alvo: ITEM_1 }),
        daNota({ alvo: { itemDeAvaliacaoChave: 'item-3' } }),
      ],
    });

    (elementoDaTela.querySelectorAll('ui-button button')[1] as HTMLButtonElement).click();

    expect(rotulosDasLinhas(elementoDaTela)).toContain('Item que a etapa não tem mais');
    expect(textoDe(elementoDaTela)).toContain(
      'O item contestado não existe mais nesta etapa. Remova o procedimento.',
    );
    expect(eventos.remover).toHaveBeenCalledExactlyOnceWith({
      tipoDeDecisao: NOTA,
      alvo: { itemDeAvaliacaoChave: 'item-3' },
    });
  });

  it('mantém a regra declarada do alvo escolhida na sua linha', async () => {
    const { elementoDaTela } = await montarEdicao({
      ...porItem,
      procedimentos: [
        daNota({
          alvo: ITEM_1,
          regra: { codigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', versao: 'v1' },
        }),
      ],
    });

    expect(seletorDa(elementoDaTela, NOTA, 0).value).toBe(MONOCRATICO);
    expect(seletorDa(elementoDaTela, NOTA, 1).value).toBe('');
  });
});
