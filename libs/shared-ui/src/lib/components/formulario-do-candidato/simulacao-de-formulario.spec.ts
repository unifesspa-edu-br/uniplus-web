import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import { interpretarFormulario } from './interpretador/interpretador';
import type { SimulacaoDoFormulario } from './interpretador/regras-do-formulario';
import {
  SimulacaoDeFormularioComponent,
  type ConferenciaComOServidor,
  type SimulacaoParaConferir,
} from './simulacao-de-formulario';

const SECAO = 'Inscricao:DADOS';

/** O nascimento de até 120 anos antes do envio até o envio: a faixa que o editor declara. */
const COM_FAIXA_DE_DATA: FormularioDoCandidato = {
  finalidade: 'INSCRICAO',
  etapas: [{ codigo: 'DADOS', codigoNasRegras: SECAO, ordem: 0, tipo: 'SECAO', titulo: 'Dados' }],
  termos: [],
  grupos: [],
  fatosColetados: [
    { fatoCodigo: 'NASCIMENTO', ordem: 0, rotulo: 'Data de nascimento', tipoRenderizacao: 'DATA' },
  ],
  regras: {
    etapas: [
      {
        codigo: SECAO,
        itens: [
          {
            fatoCodigo: 'NASCIMENTO',
            obrigatoriedade: 'SEMPRE',
            restricoes: [
              {
                tipo: 'FAIXA_DE_DATA',
                dataMinima: { ancora: 'ENVIO', anos: -120, dias: 0 },
                dataMaxima: { ancora: 'ENVIO', anos: 0, dias: 0 },
              },
            ],
          },
        ],
      },
    ],
  },
};

/** Um formulário cujo campo depende de um fato que ele não pergunta: o pressuposto TRABALHA. */
const FORMULARIO: FormularioDoCandidato = {
  finalidade: 'INSCRICAO',
  etapas: [{ codigo: 'DADOS', codigoNasRegras: SECAO, ordem: 0, tipo: 'SECAO', titulo: 'Dados' }],
  termos: [],
  grupos: [],
  fatosColetados: [
    {
      fatoCodigo: 'TURNO_NOTURNO',
      ordem: 0,
      rotulo: 'Prefere o turno noturno?',
      tipoRenderizacao: 'BOOLEANO',
    },
  ],
  regras: {
    etapas: [
      {
        codigo: SECAO,
        itens: [
          {
            fatoCodigo: 'TURNO_NOTURNO',
            obrigatoriedade: 'SEMPRE',
            exibicao: [[{ fato: 'TRABALHA', operador: 'IGUAL', valor: true }]],
          },
        ],
      },
    ],
  },
  pressupostos: [{ fatoCodigo: 'TRABALHA', calculadoDe: ['VINCULO_EMPREGATICIO'] }],
};

describe('SimulacaoDeFormularioComponent', () => {
  let fixture: ComponentFixture<SimulacaoDeFormularioComponent>;
  let enviadas: SimulacaoParaConferir[];

  const montar = (
    conferir: ConferenciaComOServidor,
    inicial: SimulacaoDoFormulario | null = null,
    formulario: FormularioDoCandidato = FORMULARIO,
  ): HTMLElement => {
    fixture = TestBed.createComponent(SimulacaoDeFormularioComponent);
    fixture.componentRef.setInput('formulario', formulario);
    fixture.componentRef.setInput('inicial', inicial);
    fixture.componentRef.setInput('conferir', conferir);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const clicar = (elemento: HTMLElement): void => {
    elemento.click();
    fixture.detectChanges();
  };
  const opcao = (tela: HTMLElement, texto: string): HTMLInputElement =>
    [...tela.querySelectorAll('label')]
      .find((l) => l.textContent?.trim() === texto)
      ?.querySelector('input') as HTMLInputElement;

  beforeEach(() => (enviadas = []));

  it('o pressuposto sem apresentação é informado na forma escolhida e muda o que o formulário mostra', () => {
    const tela = montar(() =>
      of({ ok: true, data: { etapas: [], campos: [], grupos: [], termos: [] } }),
    );
    expect(tela.textContent).toContain('Calculado pelo sistema a partir de VINCULO_EMPREGATICIO.');
    expect(tela.textContent).not.toContain('Prefere o turno noturno?');

    const forma = tela.querySelector('select') as HTMLSelectElement;
    forma.value = 'BOOLEANO';
    forma.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    clicar(opcao(tela, 'Sim'));

    expect(tela.textContent).toContain('Prefere o turno noturno?');
  });

  it('conferir com o servidor envia as regras e a simulação e diz quando o servidor decide o mesmo', () => {
    const tela = montar((simulacao) => {
      enviadas.push(simulacao);
      const local = interpretarFormulario(simulacao.regras, simulacao);
      return of(
        local.valida
          ? { ok: true as const, data: local.avaliacao }
          : { ok: true as const, data: { etapas: [], campos: [], grupos: [], termos: [] } },
      );
    });

    clicar(
      [...tela.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Conferir com o servidor',
      ) as HTMLButtonElement,
    );

    expect(enviadas).toHaveLength(1);
    expect(enviadas[0].regras).toBe(FORMULARIO.regras);
    expect(tela.textContent).toContain('Sem divergência');
  });

  describe('envio da faixa de data', () => {
    const conferirTudo = (): HTMLElement => {
      const tela = montar((simulacao) => {
        enviadas.push(simulacao);
        return of({ ok: true as const, data: { etapas: [], campos: [], grupos: [], termos: [] } });
      });
      clicar(
        [...tela.querySelectorAll('button')].find(
          (b) => b.textContent?.trim() === 'Conferir com o servidor',
        ) as HTMLButtonElement,
      );
      return tela;
    };

    it('supõe o envio de agora no fuso institucional, para o limite contado do envio valer na simulação e no servidor', () => {
      conferirTudo();

      expect(enviadas[0].envio?.fuso).toBe('America/Belem');
      expect(Number.isNaN(new Date(enviadas[0].envio?.instante ?? '').getTime())).toBe(false);
    });

    it('usa o envio do caso importado, e não o de agora', () => {
      const envio = { instante: '2030-06-15T12:00:00-03:00', fuso: 'America/Belem' };
      const tela = montar(
        (simulacao) => {
          enviadas.push(simulacao);
          return of({ ok: true as const, data: { etapas: [], campos: [], grupos: [], termos: [] } });
        },
        { envio },
      );
      clicar(
        [...tela.querySelectorAll('button')].find(
          (b) => b.textContent?.trim() === 'Conferir com o servidor',
        ) as HTMLButtonElement,
      );

      expect(enviadas[0].envio).toEqual(envio);
    });
  });

  describe('avaliação da faixa de data', () => {
    const envio = { instante: '2026-10-12T02:30:00Z', fuso: 'America/Belem' };
    const sempreOk = (): ReturnType<ConferenciaComOServidor> =>
      of({ ok: true as const, data: { etapas: [], campos: [], grupos: [], termos: [] } });
    const digitar = (tela: HTMLElement, valor: string): HTMLInputElement => {
      const input = tela.querySelector('input[type="date"]') as HTMLInputElement;
      input.value = valor;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      return input;
    };

    it('conta os limites do dia do envio da simulação, no fuso dele', () => {
      const tela = montar(sempreOk, { envio }, COM_FAIXA_DE_DATA);
      const input = tela.querySelector('input[type="date"]') as HTMLInputElement;

      expect(input.getAttribute('min')).toBe('1906-10-11');
      expect(input.getAttribute('max')).toBe('2026-10-11');
    });

    it('a data fora da faixa vira erro no campo e a dentro dela, não', () => {
      const tela = montar(sempreOk, { envio }, COM_FAIXA_DE_DATA);

      digitar(tela, '2026-10-12');
      expect(tela.querySelector('.field__error')).not.toBeNull();

      digitar(tela, '1900-01-01');
      expect(tela.querySelector('.field__error')).not.toBeNull();

      digitar(tela, '1990-05-20');
      expect(tela.querySelector('.field__error')).toBeNull();
    });

    it('sem caso importado, a simulação usa o dia de agora e o limite do envio fica determinado', () => {
      const tela = montar(sempreOk, null, COM_FAIXA_DE_DATA);
      const input = tela.querySelector('input[type="date"]') as HTMLInputElement;

      expect(input.getAttribute('max')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
