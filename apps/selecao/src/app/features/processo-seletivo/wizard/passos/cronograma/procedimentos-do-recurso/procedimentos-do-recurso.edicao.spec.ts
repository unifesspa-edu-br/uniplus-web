import { describe, expect, it } from 'vitest';

import {
  assentar,
  atualizar,
  COLEGIADO,
  escolher,
  HOMOLOGACAO,
  ID_DO_TITULO,
  MONOCRATICO,
  montarEdicao,
  NOTA,
  rotulosDosTipos,
  seletorDa,
  textoDe,
} from './procedimentos-do-recurso.edicao.testing';
import { procedimentoDoDocumento as procedimento } from './procedimentos.testing';

const daHomologacao = (parcial = {}) => procedimento({ tipoDeDecisao: HOMOLOGACAO, ...parcial });
const IDENTIDADE = { tipoDeDecisao: HOMOLOGACAO, alvo: null };

describe('ProcedimentosDoRecursoComponent em edição: o que oferece', () => {
  it('não oferece tipos nem áreas fora do vocabulário do documento', async () => {
    const { fixture, elementoDaTela } = await montarEdicao({
      tiposDeclarados: ['TIPO_INEXISTENTE', HOMOLOGACAO],
      areasDoEnem: ['AREA_INEXISTENTE', 'MATEMATICA'],
    });
    expect(rotulosDosTipos(elementoDaTela)).toEqual(['Homologação das inscrições']);
    (elementoDaTela.querySelector('input[value="porAlvo"]') as HTMLInputElement).click();
    await assentar(fixture);
    expect(elementoDaTela.querySelectorAll('select')).toHaveLength(1);
    expect(textoDe(elementoDaTela)).toContain('Matemática');
    expect(textoDe(elementoDaTela)).not.toContain('INEXISTENTE');
  });

  it('oferece só os tipos de decisão que o lugar declara, na ordem em que os declara', async () => {
    const { elementoDaTela } = await montarEdicao({ tiposDeclarados: [NOTA, HOMOLOGACAO] });

    expect(rotulosDosTipos(elementoDaTela)).toEqual([
      'Nota da etapa',
      'Homologação das inscrições',
    ]);
  });

  it('explica que não há o que escolher enquanto o lugar não declara decisão', async () => {
    const { elementoDaTela } = await montarEdicao({ tiposDeclarados: [] });

    expect(rotulosDosTipos(elementoDaTela)).toEqual([]);
    expect(textoDe(elementoDaTela)).toContain('Nenhuma decisão declarada ainda');
  });

  it('oferece no seletor só as regras do catálogo, mais a escolha vazia', async () => {
    const { elementoDaTela } = await montarEdicao();

    const valores = Array.from(seletorDa(elementoDaTela).options, (opcao) => opcao.value);

    expect(valores).toEqual(['', COLEGIADO, MONOCRATICO]);
  });

  it('mostra a regra declarada escolhida e mantém a que o catálogo deixou de ter', async () => {
    const { elementoDaTela } = await montarEdicao({
      procedimentos: [daHomologacao({ regra: { codigo: 'PROCEDIMENTO-ANTIGO', versao: 'v1' } })],
    });

    const seletor = seletorDa(elementoDaTela);

    expect(seletor.value).toBe('PROCEDIMENTO-ANTIGO|v1');
    expect(Array.from(seletor.options, (opcao) => opcao.value)).toContain(COLEGIADO);
  });

  it('põe o título no nível pedido, com o id que a página usa para devolver o foco', async () => {
    const { fixture, elementoDaTela } = await montarEdicao();
    await atualizar(fixture, {});
    fixture.componentRef.setInput('nivelDoTitulo', 3);
    fixture.detectChanges();

    expect(elementoDaTela.querySelector(`h3#${ID_DO_TITULO}`)?.textContent).toContain(
      'Procedimentos de recurso',
    );
  });

  it('desabilita o seletor e o botão de remover quando a edição está bloqueada', async () => {
    const { elementoDaTela } = await montarEdicao({
      modo: 'bloqueado',
      procedimentos: [daHomologacao()],
    });

    expect(seletorDa(elementoDaTela).disabled).toBe(true);
    expect(elementoDaTela.querySelector('ui-button button')?.hasAttribute('disabled')).toBe(true);
  });
});

describe('ProcedimentosDoRecursoComponent em edição: o que avisa', () => {
  it('avisa que falta o procedimento no tipo sem procedimento e deixa de avisar ao declarar', async () => {
    const { fixture, elementoDaTela } = await montarEdicao();

    expect(elementoDaTela.querySelector('[role="status"]')?.textContent).toContain(
      'Falta o procedimento de recurso para “Homologação das inscrições”',
    );

    await atualizar(fixture, { procedimentos: [daHomologacao()] });

    expect(elementoDaTela.querySelector('[role="status"]')).toBeNull();
  });

  it('liga o aviso de falta ao seletor do tipo', async () => {
    const { elementoDaTela } = await montarEdicao();

    const aviso = elementoDaTela.querySelector('[role="status"]') as HTMLElement;

    expect(seletorDa(elementoDaTela).getAttribute('aria-describedby')).toContain(aviso.id);
  });

  it('mantém visível o procedimento de um tipo que o lugar deixou de declarar, com aviso', async () => {
    const { elementoDaTela } = await montarEdicao({
      tiposDeclarados: [NOTA],
      procedimentos: [daHomologacao()],
    });

    expect(rotulosDosTipos(elementoDaTela)).toContain('Homologação das inscrições');
    expect(textoDe(elementoDaTela)).toContain(
      '“Homologação das inscrições” não está mais na lista de decisões',
    );
    expect(seletorDa(elementoDaTela).value).toBe(COLEGIADO);
  });

  it('não pede procedimento para o tipo que o lugar deixou de declarar', async () => {
    const { elementoDaTela } = await montarEdicao({
      tiposDeclarados: [],
      procedimentos: [daHomologacao()],
    });

    expect(textoDe(elementoDaTela)).not.toContain('Falta o procedimento');
    expect(elementoDaTela.querySelectorAll('select')).toHaveLength(1);
  });
});

describe('ProcedimentosDoRecursoComponent em edição: o que emite', () => {
  it('pede para declarar o procedimento escolhido no tipo que ainda não tem um', async () => {
    const { elementoDaTela, eventos } = await montarEdicao();

    escolher(seletorDa(elementoDaTela), MONOCRATICO);

    expect(eventos.declarar).toHaveBeenCalledExactlyOnceWith({
      identidade: IDENTIDADE,
      regra: { codigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', versao: 'v1' },
    });
    expect(eventos.trocarRegra).not.toHaveBeenCalled();
  });

  it('pede para trocar a regra do procedimento que já está declarado', async () => {
    const { elementoDaTela, eventos } = await montarEdicao({ procedimentos: [daHomologacao()] });

    escolher(seletorDa(elementoDaTela), MONOCRATICO);

    expect(eventos.trocarRegra).toHaveBeenCalledExactlyOnceWith({
      identidade: IDENTIDADE,
      regra: { codigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', versao: 'v1' },
    });
    expect(eventos.declarar).not.toHaveBeenCalled();
  });

  it('não pede nada para uma escolha fora do catálogo', async () => {
    const { elementoDaTela, eventos } = await montarEdicao();
    const seletor = seletorDa(elementoDaTela);

    escolher(seletor, 'PROCEDIMENTO-INVENTADO|v1');

    expect(eventos.declarar).not.toHaveBeenCalled();
  });

  it('pede para remover o procedimento', async () => {
    const { elementoDaTela, eventos } = await montarEdicao({ procedimentos: [daHomologacao()] });

    (elementoDaTela.querySelector('ui-button button') as HTMLButtonElement).click();

    expect(eventos.remover).toHaveBeenCalledExactlyOnceWith(IDENTIDADE);
  });

  it('devolve o foco ao tipo quando a remoção tira o botão que o tinha', async () => {
    const { fixture, elementoDaTela } = await montarEdicao({ procedimentos: [daHomologacao()] });
    fixture.componentInstance.remover.subscribe(() =>
      fixture.componentRef.setInput('procedimentos', []),
    );
    const botao = elementoDaTela.querySelector('ui-button button') as HTMLButtonElement;
    botao.focus();

    botao.click();
    await assentar(fixture);

    expect(elementoDaTela.querySelector('ui-button button')).toBeNull();
    expect(document.activeElement?.id).toBe(`${ID_DO_TITULO}-${HOMOLOGACAO}`);
  });

  it('não tira o foco de quem já o levou para outro campo antes da tela se atualizar', async () => {
    const { fixture, elementoDaTela } = await montarEdicao({
      tiposDeclarados: [HOMOLOGACAO, NOTA],
      procedimentos: [daHomologacao()],
    });
    fixture.componentInstance.remover.subscribe(() =>
      fixture.componentRef.setInput('procedimentos', []),
    );
    const outroCampo = seletorDa(elementoDaTela, NOTA);

    (elementoDaTela.querySelector('ui-button button') as HTMLButtonElement).click();
    outroCampo.focus();
    await assentar(fixture);

    expect(document.activeElement).toBe(outroCampo);
  });

  it('dá ao botão de remover um nome que diz de qual procedimento se trata', async () => {
    const { elementoDaTela } = await montarEdicao({ procedimentos: [daHomologacao()] });

    const botao = elementoDaTela.querySelector('ui-button button') as HTMLButtonElement;

    expect(botao.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Remover o procedimento de Homologação das inscrições',
    );
  });

  it('volta o seletor ao que o documento guarda quando quem monta não atende o pedido', async () => {
    const { fixture, elementoDaTela } = await montarEdicao();

    escolher(seletorDa(elementoDaTela), MONOCRATICO);
    await atualizar(fixture, {});

    expect(seletorDa(elementoDaTela).value).toBe('');
  });
});

describe('ProcedimentosDoRecursoComponent em edição: a sugestão inicial', () => {
  it('mostra a sugestão como dica da declaração inicial', async () => {
    const { elementoDaTela } = await montarEdicao({
      procedimentos: [],
      sugestao: { codigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', versao: 'v1' },
    });

    expect(textoDe(elementoDaTela)).toContain(
      'Sugestão: PROCEDIMENTO-RECURSO-MONOCRATICO — Resolução 12/2020, art. 5º',
    );
    expect(seletorDa(elementoDaTela).value).toBe('');
  });

  it('não preenche o seletor do tipo que ainda não tem procedimento', async () => {
    const { elementoDaTela } = await montarEdicao();

    expect(seletorDa(elementoDaTela).value).toBe('');
    expect(textoDe(elementoDaTela)).not.toContain('Sugestão');
  });
});
