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

const radios = (raiz: HTMLElement) =>
  Array.from(raiz.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
const rotulosDasLinhas = (raiz: HTMLElement) =>
  Array.from(raiz.querySelectorAll('sel-escolha-do-procedimento label'), (rotulo) =>
    rotulo.textContent?.trim(),
  );

describe('ProcedimentosDoRecursoComponent em edição: a decisão inteira ou por alvo', () => {
  it('não oferece a escolha de modo quando o lugar não tem alvo', async () => {
    const { raiz } = await montarEdicao();

    expect(radios(raiz)).toHaveLength(0);
    expect(rotulosDasLinhas(raiz)).toEqual(['Procedimento de recurso']);
  });

  it('oferece a decisão inteira ou um por item contestado, começando pela decisão inteira', async () => {
    const { raiz } = await montarEdicao(comItens);

    expect(radios(raiz).map((radio) => radio.value)).toEqual(['tipoInteiro', 'porAlvo']);
    expect(radios(raiz).map((radio) => radio.checked)).toEqual([true, false]);
    expect(rotulosDasLinhas(raiz)).toEqual(['Procedimento de recurso']);
  });

  it('pede a troca de modo e mostra uma linha por alvo oferecido', async () => {
    const { fixture, raiz, eventos } = await montarEdicao(comItens);

    radios(raiz)[1].click();
    await assentar(fixture);

    expect(eventos.trocarModo).toHaveBeenCalledExactlyOnceWith({
      tipoDeDecisao: NOTA,
      modo: 'porAlvo',
    });
    expect(rotulosDasLinhas(raiz)).toEqual(['Coerência', 'Argumentação']);
  });

  it('oferece as áreas do ENEM depois dos itens, cada uma na sua linha', async () => {
    const { fixture, raiz } = await montarEdicao({
      ...comItens,
      areasDoEnem: ['MATEMATICA', 'LINGUAGENS'],
    });

    radios(raiz)[1].click();
    await assentar(fixture);

    expect(rotulosDasLinhas(raiz)).toEqual([
      'Coerência',
      'Argumentação',
      'Matemática',
      'Linguagens',
    ]);
  });

  it('segue o modo dos procedimentos declarados, não a escolha anterior', async () => {
    const { raiz } = await montarEdicao({
      ...comItens,
      procedimentos: [daNota({ alvo: ITEM_1 })],
    });

    expect(radios(raiz).map((radio) => radio.checked)).toEqual([false, true]);
    expect(rotulosDasLinhas(raiz)).toEqual(['Coerência', 'Argumentação']);
  });

  it('devolve a escolha de modo ao que o documento guarda quando o pedido não é atendido', async () => {
    const { fixture, raiz } = await montarEdicao({
      ...comItens,
      procedimentos: [daNota({ alvo: ITEM_1 })],
    });

    radios(raiz)[0].click();
    await assentar(fixture);

    expect(radios(raiz).map((radio) => radio.checked)).toEqual([false, true]);
  });

  it('desabilita a escolha de modo quando a edição está bloqueada', async () => {
    const { raiz } = await montarEdicao({ ...comItens, modo: 'bloqueado' });

    expect(radios(raiz).every((radio) => radio.disabled)).toBe(true);
  });
});

describe('ProcedimentosDoRecursoComponent em edição: o modo quando os alvos mudam', () => {
  const porItem = { ...comItens, procedimentos: [daNota({ alvo: ITEM_1 })] };

  it('mantém a escolha de modo enquanto há procedimento por alvo, mesmo sem alvo oferecido', async () => {
    const { fixture, raiz, eventos } = await montarEdicao(porItem);

    await atualizar(fixture, { itensDaEtapa: [] });
    radios(raiz)[0].click();
    await assentar(fixture);

    expect(radios(raiz).map((radio) => radio.checked)).toEqual([false, true]);
    expect(rotulosDasLinhas(raiz)).toEqual(['Item que a etapa não tem mais']);
    expect(eventos.trocarModo).toHaveBeenCalledExactlyOnceWith({
      tipoDeDecisao: NOTA,
      modo: 'tipoInteiro',
    });
  });

  it('tira a escolha de modo quando não há mais alvo oferecido nem procedimento por alvo', async () => {
    const { fixture, raiz } = await montarEdicao(porItem);

    await atualizar(fixture, { itensDaEtapa: [], procedimentos: [] });

    expect(radios(raiz)).toHaveLength(0);
    expect(rotulosDasLinhas(raiz)).toEqual(['Procedimento de recurso']);
  });

  it('continua nos alvos ao remover o último procedimento por alvo', async () => {
    const { fixture, raiz } = await montarEdicao(porItem);

    await atualizar(fixture, { procedimentos: [] });

    expect(radios(raiz).map((radio) => radio.checked)).toEqual([false, true]);
    expect(rotulosDasLinhas(raiz)).toEqual(['Coerência', 'Argumentação']);
  });

  it('volta à decisão inteira, com o seletor, quando a escolha era por alvo e os alvos sumiram', async () => {
    const { fixture, raiz } = await montarEdicao(comItens);
    radios(raiz)[1].click();
    await assentar(fixture);

    await atualizar(fixture, { itensDaEtapa: [] });

    expect(radios(raiz)).toHaveLength(0);
    expect(rotulosDasLinhas(raiz)).toEqual(['Procedimento de recurso']);
    expect(seletorDa(raiz, NOTA, 0)).not.toBeNull();
  });
});

describe('ProcedimentosDoRecursoComponent em edição: uma linha por alvo', () => {
  const porItem = { ...comItens, procedimentos: [daNota({ alvo: ITEM_1 })] };

  it('declara o procedimento do alvo da linha, e não de outro', async () => {
    const { raiz, eventos } = await montarEdicao(porItem);

    escolher(seletorDa(raiz, NOTA, 1), MONOCRATICO);

    expect(eventos.declarar).toHaveBeenCalledExactlyOnceWith({
      identidade: { tipoDeDecisao: NOTA, alvo: ITEM_2 },
      regra: { codigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', versao: 'v1' },
    });
  });

  it('troca a regra só da linha que já tem procedimento', async () => {
    const { raiz, eventos } = await montarEdicao(porItem);

    escolher(seletorDa(raiz, NOTA, 0), MONOCRATICO);

    expect(eventos.trocarRegra).toHaveBeenCalledExactlyOnceWith({
      identidade: { tipoDeDecisao: NOTA, alvo: ITEM_1 },
      regra: { codigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', versao: 'v1' },
    });
  });

  it('declara por área do ENEM', async () => {
    const { raiz, eventos } = await montarEdicao({
      tiposDeclarados: [HOMOLOGACAO],
      areasDoEnem: ['MATEMATICA'],
      procedimentos: [
        procedimento({ tipoDeDecisao: HOMOLOGACAO, alvo: { areaDoEnem: Area.LINGUAGENS } }),
      ],
    });

    escolher(seletorDa(raiz, HOMOLOGACAO, 0), COLEGIADO);

    expect(eventos.declarar).toHaveBeenCalledExactlyOnceWith({
      identidade: { tipoDeDecisao: HOMOLOGACAO, alvo: { areaDoEnem: Area.MATEMATICA } },
      regra: { codigo: 'PROCEDIMENTO-RECURSO-COLEGIADO', versao: 'v1' },
    });
  });

  it('não exige procedimento para cada alvo quando o tipo já tem um', async () => {
    const { raiz } = await montarEdicao(porItem);

    expect(raiz.querySelectorAll('select')).toHaveLength(2);
    expect(textoDe(raiz)).not.toContain('Falta o procedimento');
  });

  it('avisa a falta no tipo, e não em cada alvo, enquanto nenhum alvo tem procedimento', async () => {
    const { fixture, raiz } = await montarEdicao({
      ...comItens,
      procedimentos: [daNota({ alvo: ITEM_1 })],
    });

    await atualizar(fixture, { procedimentos: [] });
    radios(raiz)[1].click();
    await assentar(fixture);

    expect(raiz.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(textoDe(raiz)).toContain('Falta o procedimento de recurso para “Nota da etapa”');
  });

  it('mantém a linha do alvo que a etapa deixou de oferecer, com aviso e remoção', async () => {
    const { raiz, eventos } = await montarEdicao({
      ...porItem,
      procedimentos: [
        daNota({ alvo: ITEM_1 }),
        daNota({ alvo: { itemDeAvaliacaoChave: 'item-3' } }),
      ],
    });

    (raiz.querySelectorAll('ui-button button')[1] as HTMLButtonElement).click();

    expect(rotulosDasLinhas(raiz)).toContain('Item que a etapa não tem mais');
    expect(textoDe(raiz)).toContain(
      'O item contestado não existe mais nesta etapa. Remova o procedimento.',
    );
    expect(eventos.remover).toHaveBeenCalledExactlyOnceWith({
      tipoDeDecisao: NOTA,
      alvo: { itemDeAvaliacaoChave: 'item-3' },
    });
  });

  it('mantém a regra declarada do alvo escolhida na sua linha', async () => {
    const { raiz } = await montarEdicao({
      ...porItem,
      procedimentos: [
        daNota({
          alvo: ITEM_1,
          regra: { codigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', versao: 'v1' },
        }),
      ],
    });

    expect(seletorDa(raiz, NOTA, 0).value).toBe(MONOCRATICO);
    expect(seletorDa(raiz, NOTA, 1).value).toBe('');
  });
});
