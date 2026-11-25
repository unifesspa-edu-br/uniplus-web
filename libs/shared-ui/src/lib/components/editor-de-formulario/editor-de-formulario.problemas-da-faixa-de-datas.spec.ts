import { beforeEach, describe, expect, it } from 'vitest';

import { CenarioDoEditorDeFormulario, conteudo, fato, item } from './editor-de-formulario.testing';
import { CenarioDaFaixaDeDatas, data } from './faixa-de-datas.testing';
import { distribuirRecusas } from './modelo/recusas';

describe('EditorDeFormularioComponent: problemas da faixa de datas', () => {
  let faixa: CenarioDaFaixaDeDatas;
  let cenario: CenarioDoEditorDeFormulario;

  beforeEach(() => {
    cenario = CenarioDoEditorDeFormulario.preparar();
    cenario.montar();
    faixa = new CenarioDaFaixaDeDatas(cenario);
  });

  it('mostra o problema do limite no controle dele, associado e marcado como inválido', () => {
    faixa.comData([
      {
        tipo: 'FAIXA_DE_DATA',
        dataMinima: { ancora: 'ENVIO', anos: 'abc', dias: 0 },
        dataMaxima: null,
      },
    ]);

    const erro = cenario.tela.querySelector(
      '#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMinima-anos-erro',
    ) as HTMLElement;
    const anos = cenario.tela.querySelector(
      '#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMinima-anos',
    ) as HTMLInputElement;

    expect(erro.textContent).toContain('Os anos são um número inteiro.');
    expect(anos.getAttribute('aria-describedby')).toContain(erro.id);
    expect(anos.getAttribute('aria-invalid')).toBe('true');
    expect(faixa.limite('NASCIMENTO', 'Data máxima').querySelector('.field__error')).toBeNull();
  });

  it('dá a cada deslocamento a mensagem do próprio problema', () => {
    faixa.comData([
      {
        tipo: 'FAIXA_DE_DATA',
        dataMinima: { ancora: 'ENVIO', anos: 151, dias: 1.5 },
        dataMaxima: null,
      },
    ]);

    const texto = (parte: string): string => {
      const campo = cenario.tela.querySelector(
        `#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMinima-${parte}`,
      ) as HTMLInputElement;
      const ids = (campo.getAttribute('aria-describedby') ?? '')
        .split(' ')
        .filter((id) => id.endsWith(`-${parte}-erro`));
      return ids.map((id) => cenario.tela.querySelector(`#${id}`)?.textContent).join('|');
    };

    expect(texto('anos')).toBe('Os anos vão até 150, para mais ou para menos.');
    expect(texto('dias')).toBe('Os dias são um número inteiro.');
  });

  it('marca o limite da faixa que não é número e o liga à mensagem, e o foco vai ao primeiro campo inválido', async () => {
    cenario.entrada('catalogo', [fato('A'), data('IDADE')]);
    cenario.entrada('conteudo', {
      ...conteudo,
      itens: [
        item('A', 0),
        item('IDADE', 1, {
          apresentacao: { tipoDeCampo: 'TEXTO' },
          regras: { restricoes: [{ tipo: 'TAMANHO_TEXTO', minimo: 'dez', maximo: 20 }] },
        }),
      ],
    });
    cenario.detectar();

    const minimo = cenario.tela.querySelector(
      '#f-item-IDADE-TAMANHO_TEXTO-minimo',
    ) as HTMLInputElement;
    const maximo = cenario.tela.querySelector(
      '#f-item-IDADE-TAMANHO_TEXTO-maximo',
    ) as HTMLInputElement;
    const erro = cenario.tela.querySelector('.field__error') as HTMLElement;

    expect(erro.textContent).toContain('Os limites são números inteiros, a partir de zero.');
    expect(minimo.getAttribute('aria-invalid')).toBe('true');
    expect(minimo.getAttribute('aria-describedby')).toContain(erro.id);
    expect(maximo.getAttribute('aria-invalid')).toBeNull();
    expect(await cenario.fixture.componentInstance.focarPrimeiroCampoInvalido()).toBe(true);
    expect(document.activeElement).toBe(minimo);
  });

  it('marca só o deslocamento que não é número, e a mensagem dele fica ligada só a ele', () => {
    faixa.comData([
      {
        tipo: 'FAIXA_DE_DATA',
        dataMinima: { ancora: 'ENVIO', anos: 0, dias: 'dez' },
        dataMaxima: null,
      },
    ]);

    const anos = cenario.tela.querySelector(
      '#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMinima-anos',
    ) as HTMLInputElement;
    const dias = cenario.tela.querySelector(
      '#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMinima-dias',
    ) as HTMLInputElement;
    const erro = cenario.tela.querySelector(
      '#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMinima-dias-erro',
    ) as HTMLElement;

    expect(anos.getAttribute('aria-invalid')).toBeNull();
    expect(dias.getAttribute('aria-invalid')).toBe('true');
    expect(dias.getAttribute('aria-describedby')).toContain(erro.id);
    expect(anos.getAttribute('aria-describedby')).not.toContain(erro.id);
  });

  it.each([
    ['anos fracionários', 1.5, 0, 'anos'],
    ['dias fracionários', 0, 1.5, 'dias'],
    ['anos acima do limite', 100000, 0, 'anos'],
    ['dias acima do limite', 0, 10000000, 'dias'],
  ])(
    'marca só o deslocamento com problema próprio: %s',
    (_nome, anosDigitados, diasDigitados, marcado) => {
      faixa.comData([
        {
          tipo: 'FAIXA_DE_DATA',
          dataMinima: { ancora: 'ENVIO', anos: anosDigitados, dias: diasDigitados },
          dataMaxima: null,
        },
      ]);

      const marca = (parte: string): string | null =>
        (
          cenario.tela.querySelector(
            `#f-item-NASCIMENTO-FAIXA_DE_DATA-dataMinima-${parte}`,
          ) as HTMLInputElement
        ).getAttribute('aria-invalid');
      const outro = marcado === 'anos' ? 'dias' : 'anos';

      expect(
        faixa.limite('NASCIMENTO', 'Data mínima').querySelector('.field__error'),
      ).not.toBeNull();
      expect(marca(marcado)).toBe('true');
      expect(marca(outro)).toBeNull();
    },
  );

  it('mostra a mínima depois da máxima no controle da data máxima', () => {
    faixa.comData([
      {
        tipo: 'FAIXA_DE_DATA',
        dataMinima: { ancora: 'DATA_FIXA', data: '2030-01-02' },
        dataMaxima: { ancora: 'DATA_FIXA', data: '2030-01-01' },
      },
    ]);

    expect(faixa.limite('NASCIMENTO', 'Data máxima').textContent).toContain(
      'A data mínima fica depois da data máxima.',
    );
    expect(faixa.limite('NASCIMENTO', 'Data mínima').textContent).not.toContain(
      'A data mínima fica depois da data máxima.',
    );
  });

  it('a recusa de mínimo maior que o máximo aparece no controle da data máxima', () => {
    faixa.comData([
      {
        tipo: 'FAIXA_DE_DATA',
        dataMinima: { ancora: 'ENVIO', anos: 0, dias: 5 },
        dataMaxima: { ancora: 'ENVIO', anos: 0, dias: 1 },
      },
    ]);
    cenario.entrada(
      'recusas',
      distribuirRecusas(
        [
          {
            field: 'conteudo.itens[1].restricoes[0]',
            message: 'A data mínima fica depois da data máxima.',
          },
        ],
        cenario.fixture.componentInstance.conteudo(),
      ),
    );
    cenario.detectar();

    const recusa = faixa
      .limite('NASCIMENTO', 'Data máxima')
      .querySelector('.editor-formulario__erros') as HTMLElement;
    expect(recusa.textContent).toContain('A data mínima fica depois da data máxima.');
    for (const limite of ['dataMinima', 'dataMaxima']) {
      const controle = cenario.tela.querySelector(
        `#f-item-NASCIMENTO-FAIXA_DE_DATA-${limite}-contado-de`,
      ) as HTMLSelectElement;
      expect(controle.getAttribute('aria-describedby'), limite).toContain(recusa.id);
    }
  });
});
