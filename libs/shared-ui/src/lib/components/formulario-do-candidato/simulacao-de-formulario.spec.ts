import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import { interpretarFormulario } from './interpretador/interpretador';
import {
  SimulacaoDeFormularioComponent,
  type ConferenciaComOServidor,
  type SimulacaoParaConferir,
} from './simulacao-de-formulario';

const SECAO = 'Inscricao:DADOS';

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

  const montar = (conferir: ConferenciaComOServidor): HTMLElement => {
    fixture = TestBed.createComponent(SimulacaoDeFormularioComponent);
    fixture.componentRef.setInput('formulario', FORMULARIO);
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
});
