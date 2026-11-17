import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import { CenarioDoFormularioDoCandidato } from './formulario-do-candidato.testing';
import {
  CODIGO_DA_SECAO_DE_DADOS,
  FORMULARIO_COM_TELEFONE,
  FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  campoRenderizavel,
  itemDasRegras,
} from './formularios-de-exemplo.testing';

describe('FormularioDoCandidatoComponent', () => {
  let cenario: CenarioDoFormularioDoCandidato;

  beforeEach(() => {
    cenario = CenarioDoFormularioDoCandidato.preparar();
  });

  it('a resposta que viola a faixa mostra a mensagem com os limites ao lado do campo', () => {
    const tela = cenario.montar({
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      fatosColetados: [campoRenderizavel('NOTA', 'Nota', 'NUMERO')],
      regras: {
        etapas: [
          {
            codigo: CODIGO_DA_SECAO_DE_DADOS,
            itens: [
              itemDasRegras('NOTA', { restricoes: [{ tipo: 'FAIXA_NUMERICA', minimo: 0.5 }] }),
            ],
          },
        ],
      },
    });
    const input = tela.querySelector('input') as HTMLInputElement;

    cenario.digitar(input, '0,4');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(tela.querySelector('.field__error')?.textContent).toContain(
      'Informe um número igual ou maior que 0,5.',
    );
  });

  describe('faixa de data', () => {
    /** O nascimento de até 120 anos antes do envio até o envio, a regra do conjunto básico. */
    const NASCIMENTO: FormularioDoCandidato = {
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      fatosColetados: [campoRenderizavel('DATA_NASCIMENTO', 'Data de nascimento', 'DATA')],
      regras: {
        etapas: [
          {
            codigo: CODIGO_DA_SECAO_DE_DADOS,
            itens: [
              itemDasRegras('DATA_NASCIMENTO', {
                restricoes: [
                  {
                    tipo: 'FAIXA_DE_DATA',
                    dataMinima: { ancora: 'ENVIO', anos: -120, dias: 0 },
                    dataMaxima: { ancora: 'ENVIO', anos: 0, dias: 0 },
                  },
                ],
              }),
            ],
          },
        ],
      },
    };
    /** 23h30 de 11/10/2026 em Belém, já 12/10 em UTC: o dia do envio é 11/10. */
    const ENVIO = { instante: '2026-10-12T02:30:00Z', fuso: 'America/Belem' };
    const dataDe = (tela: HTMLElement): HTMLInputElement =>
      tela.querySelector('input[type="date"]') as HTMLInputElement;
    const sair = (input: HTMLInputElement): void => {
      input.dispatchEvent(new Event('blur'));
      cenario.fixture.detectChanges();
    };

    it('o calendário vai dos limites contados do dia do envio no fuso dele', () => {
      const input = dataDe(cenario.montar(NASCIMENTO, { envio: ENVIO }));

      expect(input.getAttribute('min')).toBe('1906-10-11');
      expect(input.getAttribute('max')).toBe('2026-10-11');
    });

    it('sem faixa, o calendário ainda prende o ano em quatro dígitos', () => {
      const input = dataDe(
        cenario.montar({
          ...NASCIMENTO,
          regras: {
            etapas: [
              { codigo: CODIGO_DA_SECAO_DE_DADOS, itens: [itemDasRegras('DATA_NASCIMENTO')] },
            ],
          },
        }),
      );

      expect(input.getAttribute('max')).toBe('9999-12-31');
    });

    it('a dica dos limites, em dd/mm/aaaa, descreve o campo antes de qualquer erro', () => {
      const tela = cenario.montar(NASCIMENTO, { envio: ENVIO });
      const input = dataDe(tela);
      const dica = tela.querySelector('.field__hint');

      expect(dica?.textContent?.trim()).toBe('Informe uma data entre 11/10/1906 e 11/10/2026.');
      expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(dica?.id);
      expect(tela.querySelector('.field__error')).toBeNull();
    });

    it('a data fora dos limites só vira erro quando o candidato sai do campo', () => {
      const tela = cenario.montar(NASCIMENTO, { envio: ENVIO });
      const input = dataDe(tela);

      cenario.digitar(input, '2027-01-10');
      expect(tela.querySelector('.field__error')).toBeNull();
      expect(input.getAttribute('aria-invalid')).toBeNull();

      sair(input);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(tela.querySelector('.field__error')?.textContent).toContain(
        'Informe uma data entre 11/10/1906 e 11/10/2026.',
      );

      cenario.digitar(input, '2027-01-11');
      expect(tela.querySelector('.field__error')).toBeNull();
    });

    it('concluir a seção mostra a data fora dos limites sem esperar o candidato sair do campo', () => {
      const tela = cenario.montar(NASCIMENTO, { envio: ENVIO });

      cenario.digitar(dataDe(tela), '2027-01-10');
      cenario.clicar(cenario.botao('Concluir a seção'));

      expect(tela.querySelector('.field__error')?.textContent).toContain(
        'Informe uma data entre 11/10/1906 e 11/10/2026.',
      );
    });

    it('sem envio, o limite contado dele não tem dica, e a simulação não leva envio', () => {
      const tela = cenario.montar(NASCIMENTO);

      expect(tela.querySelector('.field__hint')).toBeNull();
      expect(cenario.simulacoes.at(-1)?.envio).toBeNull();
    });
  });

  it('a resposta fixa entra na simulação com o valor, e o campo só mostra a exibição', () => {
    const tela = cenario.montar(
      {
        ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
        fatosColetados: [campoRenderizavel('CPF', 'CPF', 'TEXTO', { formato: 'CPF' })],
        regras: { etapas: [{ codigo: CODIGO_DA_SECAO_DE_DADOS, itens: [itemDasRegras('CPF')] }] },
      },
      { respostasFixas: { CPF: { valor: '69959836371', exibicao: '***.598.363-**' } } },
    );
    const input = tela.querySelector('input') as HTMLInputElement;

    expect(input.readOnly).toBe(true);
    expect(input.value).toBe('***.598.363-**');
    expect(cenario.simulacoes.at(-1)?.respostas).toEqual({ CPF: '69959836371' });
  });

  it('a resposta fixa fora do formato não mostra erro no campo', () => {
    const tela = cenario.montar(
      {
        ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
        fatosColetados: [
          campoRenderizavel('NOME', 'Nome completo', 'TEXTO', { formato: 'NOME_PESSOA' }),
        ],
        regras: {
          etapas: [
            {
              codigo: CODIGO_DA_SECAO_DE_DADOS,
              itens: [itemDasRegras('NOME', { formato: 'NOME_PESSOA' })],
            },
          ],
        },
      },
      { respostasFixas: { NOME: { valor: 'Maria S. Silva', exibicao: 'Maria S. Silva' } } },
    );
    const input = tela.querySelector('input') as HTMLInputElement;

    expect(input.value).toBe('Maria S. Silva');
    expect(tela.querySelector('.field__error')).toBeNull();
  });

  it('o telefone vai à resposta só com os dígitos e ganha a máscara ao sair do campo', () => {
    const tela = cenario.montar(FORMULARIO_COM_TELEFONE);
    const input = tela.querySelector('input') as HTMLInputElement;

    cenario.digitar(input, '61981951555');
    expect(cenario.simulacoes.at(-1)?.respostas).toEqual({ TELEFONE: '61981951555' });

    input.dispatchEvent(new Event('blur'));
    cenario.fixture.detectChanges();
    expect(input.value).toBe('(61) 98195-1555');

    cenario.digitar(input, '(94) 3322-1234');
    expect(cenario.simulacoes.at(-1)?.respostas).toEqual({ TELEFONE: '9433221234' });
    input.dispatchEvent(new Event('blur'));
    cenario.fixture.detectChanges();
    expect(input.value).toBe('(94) 3322-1234');
    expect(cenario.simulacoes.at(-1)?.respostas).toEqual({ TELEFONE: '9433221234' });
  });

  it('o telefone gravado aparece com a máscara, e o que não é telefone fica como foi digitado', () => {
    const tela = cenario.montar(FORMULARIO_COM_TELEFONE, {
      inicial: { respostas: { TELEFONE: '61981951555' } },
    });
    const input = tela.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('(61) 98195-1555');

    cenario.digitar(input, '619819');
    input.dispatchEvent(new Event('blur'));
    cenario.fixture.detectChanges();
    expect(input.value).toBe('619819');
    expect(cenario.simulacoes.at(-1)?.respostas).toEqual({ TELEFONE: '619819' });
  });
});
