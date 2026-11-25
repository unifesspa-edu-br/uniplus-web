import { beforeEach, describe, expect, it } from 'vitest';

import { CenarioDoEditorDeFormulario, conteudo, fato, item } from './editor-de-formulario.testing';
import { CenarioDaFaixaDeDatas, data } from './faixa-de-datas.testing';

describe('EditorDeFormularioComponent: faixa de datas', () => {
  let faixa: CenarioDaFaixaDeDatas;
  let cenario: CenarioDoEditorDeFormulario;

  beforeEach(() => {
    cenario = CenarioDoEditorDeFormulario.preparar();
    cenario.montar();
    faixa = new CenarioDaFaixaDeDatas(cenario);
  });

  it('só o campo de data oferece a faixa', () => {
    faixa.comData();
    const opcoes = (codigo: string): string[] =>
      [
        ...(cenario.tela.querySelectorAll(
          `#f-item-${codigo}-restricao option`,
        ) as NodeListOf<HTMLOptionElement>),
      ].map((o) => o.value);

    expect(opcoes('NASCIMENTO')).toContain('FAIXA_DE_DATA');
    expect(cenario.tela.querySelector('#f-item-A-restricao')).toBeNull();
  });

  it('acrescenta a faixa sem limite e pede ao menos um', () => {
    faixa.comData();
    faixa.acrescentarFaixa();

    expect(faixa.emitida('NASCIMENTO')).toEqual([
      { tipo: 'FAIXA_DE_DATA', dataMinima: null, dataMaxima: null },
    ]);
    expect(faixa.faixaDe('NASCIMENTO').textContent).toContain('Informe ao menos um limite.');
  });

  it('declara o limite como data fixa ou como o dia do envio deslocado, com número negativo', () => {
    faixa.comData([{ tipo: 'FAIXA_DE_DATA', dataMinima: null, dataMaxima: null }]);

    faixa.trocar(
      cenario.tela.querySelector(
        '#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMinima-contado-de',
      ) as HTMLSelectElement,
      'ENVIO',
    );
    faixa.trocar(
      cenario.tela.querySelector(
        '#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMinima-anos',
      ) as HTMLInputElement,
      '−120',
    );
    faixa.trocar(
      cenario.tela.querySelector(
        '#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMaxima-contado-de',
      ) as HTMLSelectElement,
      'DATA_FIXA',
    );
    faixa.trocar(
      cenario.tela.querySelector(
        '#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMaxima-data',
      ) as HTMLInputElement,
      '2030-12-31',
    );

    expect(faixa.emitida('NASCIMENTO')).toEqual([
      {
        tipo: 'FAIXA_DE_DATA',
        dataMinima: { ancora: 'ENVIO', anos: -120, dias: 0 },
        dataMaxima: { ancora: 'DATA_FIXA', data: '2030-12-31' },
      },
    ]);
  });

  it('volta o limite a sem limite', () => {
    faixa.comData([
      {
        tipo: 'FAIXA_DE_DATA',
        dataMinima: { ancora: 'DATA_FIXA', data: '2000-01-01' },
        dataMaxima: { ancora: 'ENVIO', anos: 0, dias: 0 },
      },
    ]);

    faixa.trocar(
      cenario.tela.querySelector(
        '#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMinima-contado-de',
      ) as HTMLSelectElement,
      '',
    );

    expect(faixa.emitida('NASCIMENTO')).toEqual([
      {
        tipo: 'FAIXA_DE_DATA',
        dataMinima: null,
        dataMaxima: { ancora: 'ENVIO', anos: 0, dias: 0 },
      },
    ]);
  });

  it('rotula os controles e liga a dica da faixa a eles por aria-describedby', () => {
    faixa.comData([
      {
        tipo: 'FAIXA_DE_DATA',
        dataMinima: { ancora: 'DATA_FIXA', data: '2000-01-01' },
        dataMaxima: { ancora: 'ENVIO', anos: 0, dias: 0 },
      },
    ]);
    const dica = cenario.tela.querySelector('#f-item-NASCIMENTO-FAIXA_DE_DATA-dica') as HTMLElement;
    const controles = [...faixa.faixaDe('NASCIMENTO').querySelectorAll('select, input')].filter(
      (c) => c.closest('.editor-formulario__limite'),
    ) as HTMLElement[];

    expect(dica.textContent).toContain('dia do envio');
    expect(controles.length).toBe(5);
    for (const controle of controles) {
      expect(cenario.tela.querySelector(`label[for="${controle.id}"]`), controle.id).not.toBeNull();
      expect(controle.getAttribute('aria-describedby') ?? '', controle.id).toContain(dica.id);
    }
  });

  it('os deslocamentos do dia do envio aceitam o sinal de menos no teclado do aparelho', () => {
    faixa.comData([
      {
        tipo: 'FAIXA_DE_DATA',
        dataMinima: { ancora: 'ENVIO', anos: -18, dias: 0 },
        dataMaxima: null,
      },
    ]);

    for (const parte of ['anos', 'dias']) {
      const campo = cenario.tela.querySelector(
        `#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMinima-${parte}`,
      ) as HTMLInputElement;
      expect(campo.hasAttribute('inputmode'), parte).toBe(false);
    }
  });

  it('o subitem de data de um grupo também declara a faixa', () => {
    cenario.entrada('catalogo', [fato('A'), data('NASCIMENTO_FILHO')]);
    cenario.entrada('conteudo', {
      ...conteudo,
      itens: [item('A', 0)],
      grupos: [
        {
          codigo: 'FILHOS',
          ordem: 1,
          rotulo: 'Filhos',
          paginaCodigo: 'S1',
          ocorrencias: { minimo: 0, maximo: null, incluiCandidato: false },
          regras: { exibicao: null, obrigatoriedade: { tipo: 'NUNCA', predicado: null } },
          subitens: [item('NASCIMENTO_FILHO', 0, { apresentacao: { tipoDeCampo: 'DATA' } })],
        },
      ],
    });
    cenario.detectar();

    expect(
      [...cenario.tela.querySelectorAll('select option')].some(
        (o) => (o as HTMLOptionElement).value === 'FAIXA_DE_DATA',
      ),
    ).toBe(true);
  });
});
