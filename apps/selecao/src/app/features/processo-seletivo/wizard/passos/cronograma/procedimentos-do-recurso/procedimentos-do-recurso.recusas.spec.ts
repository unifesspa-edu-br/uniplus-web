import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import {
  assentar,
  HOMOLOGACAO,
  montarEdicao,
  NOTA,
  seletorDa,
  type EntradasDaEdicao,
  type MontagemDaEdicao,
} from './procedimentos-do-recurso.edicao.testing';
import {
  procedimento as antigo,
  procedimentoDoDocumento as procedimento,
} from './procedimentos.testing';

const ITEM_1 = { itemDeAvaliacaoChave: 'item-1' };
const ITENS = [{ chave: 'item-1', rotulo: 'Coerência', pontuacaoMaxima: 5 }];
const CONFLITANTE = {
  codigo: 'uniplus.selecao.recurso_da_etapa.procedimento_de_recurso_conflitante',
  mensagem: 'O tipo já tem procedimento para a decisão inteira.',
  pagina: 'https://developers.example.test/erros/procedimento_de_recurso_conflitante',
};
const SEM_PAGINA = {
  ...CONFLITANTE,
  codigo: 'uniplus.selecao.recurso_da_etapa.duplicado',
  pagina: null,
};

const violacoes = async ({ elementoDaTela }: MontagemDaEdicao) =>
  (
    await axe.run(elementoDaTela, {
      rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
    })
  ).violations;

const daHomologacao = () => procedimento({ tipoDeDecisao: HOMOLOGACAO });

const comRecusa = (entradas: Partial<EntradasDaEdicao> = {}) =>
  montarEdicao({
    procedimentos: [daHomologacao()],
    recusas: [{ tipoDeDecisao: HOMOLOGACAO, alvo: null, recusa: CONFLITANTE }],
    ...entradas,
  });

describe('ProcedimentosDoRecursoComponent em edição: a recusa da API', () => {
  it.each([false, true])(
    'conserva leitura antiga com recusa e entrada mista: %s',
    async (mista) => {
      const { elementoDaTela } = await montarEdicao({
        modo: 'consulta',
        procedimentos: [
          antigo({ regraCodigo: 'REGRA-ANTIGA' }),
          ...(mista ? [daHomologacao()] : []),
        ],
        recusas: [{ tipoDeDecisao: null, alvo: null, semLinha: true, recusa: CONFLITANTE }],
      });
      expect(elementoDaTela.textContent).toContain('REGRA-ANTIGA');
      if (mista) expect(elementoDaTela.textContent).toContain('PROCEDIMENTO-RECURSO-COLEGIADO');
      expect(elementoDaTela.textContent).toContain(CONFLITANTE.codigo);
    },
  );
  it('mantém recusas visíveis na consulta do documento sem oferecer edição', async () => {
    const { elementoDaTela } = await montarEdicao({
      modo: 'consulta',
      procedimentos: [daHomologacao()],
      recusas: [{ tipoDeDecisao: HOMOLOGACAO, alvo: null, recusa: CONFLITANTE }],
    });
    expect(elementoDaTela.querySelector('ui-recusa-do-campo')?.textContent).toContain(
      CONFLITANTE.codigo,
    );
    expect(elementoDaTela.querySelector('input, select, button')).toBeNull();
    expect(elementoDaTela.textContent).toContain('PROCEDIMENTO-RECURSO-COLEGIADO');
  });

  it('mostra ausência junto à janela mesmo sem tipos nem linhas de procedimento', async () => {
    const { elementoDaTela } = await montarEdicao({
      tiposDeclarados: [],
      recusas: [{ tipoDeDecisao: null, alvo: null, semLinha: true, recusa: CONFLITANTE }],
    });
    expect(elementoDaTela.querySelector('ui-recusa-do-campo')?.textContent).toContain(
      CONFLITANTE.codigo,
    );
  });

  it('liga a recusa da janela aos seletores dos tipos declarados', async () => {
    const { elementoDaTela } = await montarEdicao({
      recusas: [{ tipoDeDecisao: null, alvo: null, semLinha: true, recusa: CONFLITANTE }],
    });
    const recusa = elementoDaTela.querySelector('ui-recusa-do-campo') as HTMLElement;
    expect(seletorDa(elementoDaTela).getAttribute('aria-describedby')).toContain(recusa.id);
  });

  it('mostra ausência do tipo junto ao tipo, sem atribuí-la a uma linha vazia', async () => {
    const { elementoDaTela } = await montarEdicao({
      recusas: [{ tipoDeDecisao: HOMOLOGACAO, alvo: null, semLinha: true, recusa: CONFLITANTE }],
    });
    const recusa = elementoDaTela.querySelector('ui-recusa-do-campo') as HTMLElement;
    expect(recusa.closest('fieldset')?.getAttribute('aria-describedby')).toBe(recusa.id);
    expect(recusa.textContent).toContain(CONFLITANTE.mensagem);
    expect(seletorDa(elementoDaTela).getAttribute('aria-describedby')).toContain(recusa.id);
    expect(seletorDa(elementoDaTela).getAttribute('aria-invalid')).toBeNull();
  });

  it('mantém recusas repetidas na ocorrência exata de uma duplicata importada', async () => {
    const declarado = procedimento({ tipoDeDecisao: HOMOLOGACAO });
    const { elementoDaTela } = await montarEdicao({
      procedimentos: [declarado, declarado],
      recusas: [
        { tipoDeDecisao: HOMOLOGACAO, alvo: null, ocorrencia: 1, recusa: CONFLITANTE },
        { tipoDeDecisao: HOMOLOGACAO, alvo: null, ocorrencia: 1, recusa: SEM_PAGINA },
      ],
    });
    expect(seletorDa(elementoDaTela, HOMOLOGACAO, 0).getAttribute('aria-invalid')).toBeNull();
    expect(seletorDa(elementoDaTela, HOMOLOGACAO, 1).getAttribute('aria-invalid')).toBe('true');
    const codigos = Array.from(
      elementoDaTela.querySelectorAll('ui-recusa-do-campo code'),
      (codigo) => codigo.textContent,
    );
    expect(codigos).toEqual([CONFLITANTE.codigo, SEM_PAGINA.codigo]);
  });

  it('mostra a recusa junto ao seletor, com o código e o link da página do erro', async () => {
    const { elementoDaTela } = await comRecusa();

    const recusa = elementoDaTela.querySelector('ui-recusa-do-campo') as HTMLElement;

    expect(recusa.textContent).toContain(CONFLITANTE.mensagem);
    expect(recusa.querySelector('code')?.textContent).toBe(CONFLITANTE.codigo);
    expect(recusa.querySelector('a')?.getAttribute('href')).toBe(CONFLITANTE.pagina);
  });

  it('liga a recusa ao seletor por aria-describedby e o marca como inválido', async () => {
    const { elementoDaTela } = await comRecusa();

    const recusa = elementoDaTela.querySelector('ui-recusa-do-campo') as HTMLElement;
    const seletor = seletorDa(elementoDaTela);

    expect(recusa.id).not.toBe('');
    expect(seletor.getAttribute('aria-describedby')).toContain(recusa.id);
    expect(seletor.getAttribute('aria-invalid')).toBe('true');
  });

  it('mostra só o texto e o código quando a recusa não tem página', async () => {
    const { elementoDaTela } = await comRecusa({
      recusas: [{ tipoDeDecisao: HOMOLOGACAO, alvo: null, recusa: SEM_PAGINA }],
    });

    expect(elementoDaTela.querySelector('ui-recusa-do-campo a')).toBeNull();
    expect(elementoDaTela.querySelector('ui-recusa-do-campo code')?.textContent).toBe(
      SEM_PAGINA.codigo,
    );
  });

  it('junta a recusa ao alvo a que ela se refere, e não aos outros', async () => {
    const { elementoDaTela } = await montarEdicao({
      tiposDeclarados: [NOTA],
      itensDaEtapa: [...ITENS, { chave: 'item-2', rotulo: 'Argumentação', pontuacaoMaxima: 5 }],
      procedimentos: [procedimento({ tipoDeDecisao: NOTA, alvo: ITEM_1 })],
      recusas: [{ tipoDeDecisao: NOTA, alvo: ITEM_1, recusa: CONFLITANTE }],
    });

    expect(seletorDa(elementoDaTela, NOTA, 0).getAttribute('aria-invalid')).toBe('true');
    expect(seletorDa(elementoDaTela, NOTA, 1).getAttribute('aria-invalid')).toBeNull();
    expect(elementoDaTela.querySelectorAll('ui-recusa-do-campo')).toHaveLength(1);
  });

  it('mostra a recusa do tipo inteiro junto ao tipo quando o procedimento é por alvo', async () => {
    const { elementoDaTela } = await montarEdicao({
      tiposDeclarados: [NOTA],
      itensDaEtapa: ITENS,
      procedimentos: [procedimento({ tipoDeDecisao: NOTA, alvo: ITEM_1 })],
      recusas: [{ tipoDeDecisao: NOTA, alvo: null, recusa: CONFLITANTE }],
    });

    const recusa = elementoDaTela.querySelector('ui-recusa-do-campo') as HTMLElement;

    expect(recusa.textContent).toContain(CONFLITANTE.mensagem);
    expect(recusa.closest('fieldset')?.getAttribute('aria-describedby')).toBe(recusa.id);
    expect(seletorDa(elementoDaTela, NOTA, 0).getAttribute('aria-describedby')).toContain(
      recusa.id,
    );
    expect(
      elementoDaTela.querySelector('input[type=radio]')?.getAttribute('aria-describedby'),
    ).toContain(recusa.id);
    expect(seletorDa(elementoDaTela, NOTA, 0).getAttribute('aria-invalid')).toBeNull();
  });

  it('mostra junto ao tipo a recusa de um alvo quando o modo vigente é a decisão inteira', async () => {
    const { elementoDaTela } = await montarEdicao({
      tiposDeclarados: [NOTA],
      itensDaEtapa: ITENS,
      procedimentos: [procedimento({ tipoDeDecisao: NOTA })],
      recusas: [{ tipoDeDecisao: NOTA, alvo: ITEM_1, recusa: CONFLITANTE }],
    });

    const recusa = elementoDaTela.querySelector('ui-recusa-do-campo') as HTMLElement;

    expect(elementoDaTela.querySelectorAll('ui-recusa-do-campo')).toHaveLength(1);
    expect(recusa.closest('fieldset')?.getAttribute('aria-describedby')).toBe(recusa.id);
    expect(seletorDa(elementoDaTela, NOTA, 0).getAttribute('aria-invalid')).toBeNull();
  });

  it('mostra junto ao tipo a recusa de um alvo que nenhuma linha oferece', async () => {
    const { elementoDaTela } = await montarEdicao({
      tiposDeclarados: [NOTA],
      itensDaEtapa: ITENS,
      procedimentos: [procedimento({ tipoDeDecisao: NOTA, alvo: ITEM_1 })],
      recusas: [
        { tipoDeDecisao: NOTA, alvo: { itemDeAvaliacaoChave: 'item-9' }, recusa: CONFLITANTE },
      ],
    });

    const recusa = elementoDaTela.querySelector('ui-recusa-do-campo') as HTMLElement;

    expect(recusa.closest('fieldset')?.getAttribute('aria-describedby')).toBe(recusa.id);
  });

  it('mostra a recusa da decisão inteira só na linha dela, e não também junto ao tipo', async () => {
    const { elementoDaTela } = await montarEdicao({
      tiposDeclarados: [NOTA],
      procedimentos: [procedimento({ tipoDeDecisao: NOTA })],
      recusas: [{ tipoDeDecisao: NOTA, alvo: null, recusa: CONFLITANTE }],
    });

    expect(elementoDaTela.querySelectorAll('ui-recusa-do-campo')).toHaveLength(1);
    expect(seletorDa(elementoDaTela, NOTA, 0).getAttribute('aria-invalid')).toBe('true');
    expect(
      elementoDaTela
        .querySelector('sel-procedimento-do-tipo > fieldset')
        ?.getAttribute('aria-describedby'),
    ).toBeNull();
  });

  it('mostra junto à seção a recusa de um tipo que não aparece', async () => {
    const { elementoDaTela } = await comRecusa({
      recusas: [{ tipoDeDecisao: NOTA, alvo: null, recusa: CONFLITANTE }],
    });

    expect(elementoDaTela.querySelector('ui-recusa-do-campo')?.textContent).toContain(
      CONFLITANTE.codigo,
    );
  });

  it.each(['edicao', 'bloqueado', 'consulta'] as const)(
    'mostra a recusa junto ao tipo sem período no modo %s',
    async (modo) => {
      const { elementoDaTela } = await montarEdicao({
        modo,
        temJanela: false,
        recusas: [{ tipoDeDecisao: HOMOLOGACAO, alvo: null, recusa: CONFLITANTE }],
      });
      expect(elementoDaTela.querySelector('ui-recusa-do-campo')?.textContent).toContain(
        CONFLITANTE.codigo,
      );
    },
  );
});

describe('ProcedimentosDoRecursoComponent em edição: acessibilidade', () => {
  it('não tem violações com o aviso de falta e o seletor vazio', async () => {
    const montagem = await montarEdicao();

    expect(montagem.elementoDaTela.querySelector('[role="status"]')).not.toBeNull();
    expect(await violacoes(montagem)).toEqual([]);
  });

  it('não tem violações com procedimento declarado, sugestão e remoção', async () => {
    const montagem = await montarEdicao({
      procedimentos: [daHomologacao()],
      sugestao: { codigo: 'PROCEDIMENTO-RECURSO-MONOCRATICO', versao: 'v1' },
    });

    expect(await violacoes(montagem)).toEqual([]);
  });

  it('não tem violações com a recusa ligada ao seletor', async () => {
    expect(await violacoes(await comRecusa())).toEqual([]);
  });

  it('não tem violações com a escolha de modo, as linhas por alvo e o alvo que sobrou', async () => {
    const montagem = await montarEdicao({
      tiposDeclarados: [NOTA, HOMOLOGACAO],
      itensDaEtapa: ITENS,
      procedimentos: [procedimento({ tipoDeDecisao: NOTA, alvo: ITEM_1 }), daHomologacao()],
    });
    await assentar(montagem.fixture);

    expect(await violacoes(montagem)).toEqual([]);
  });

  it('não tem violações com a edição bloqueada e o tipo que o lugar deixou de declarar', async () => {
    const montagem = await montarEdicao({
      modo: 'bloqueado',
      tiposDeclarados: [],
      procedimentos: [daHomologacao()],
    });

    expect(await violacoes(montagem)).toEqual([]);
  });
});
