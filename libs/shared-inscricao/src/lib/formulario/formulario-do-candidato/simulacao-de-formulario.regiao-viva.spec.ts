import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { ApiResult } from '@uniplus/shared-core/http';
import axe from 'axe-core';
import { NEVER, Subject, of } from 'rxjs';
import {
  errorResult,
  mockProblemDetails,
  mockValidationError,
  okResult,
} from '@uniplus/shared-testing';

import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import { apresentacaoDaPagina, campoApresentado } from './formularios-de-exemplo.testing';
import { interpretarFormulario } from './interpretador/interpretador';
import type { AvaliacaoDoFormulario } from './interpretador/regras-do-formulario';
import {
  SimulacaoDeFormularioComponent,
  type ConferenciaComOServidor,
  type SimulacaoParaConferir,
} from './simulacao-de-formulario';

const FORMULARIO: FormularioDoCandidato = {
  paginas: [
    {
      codigo: 'DADOS',
      codigoNasRegras: 'Inscricao:DADOS',
      ordem: 0,
      tipo: 'SECAO',
      apresentacao: apresentacaoDaPagina('Dados'),
    },
  ],
  termos: [],
  coleta: { itens: [], grupos: [] },
  pressupostos: { fatos: [] },
  regras: { paginas: [{ codigo: 'Inscricao:DADOS', itens: [] }] },
};

const COM_UMA_PERGUNTA: FormularioDoCandidato = {
  ...FORMULARIO,
  coleta: {
    itens: [campoApresentado('TURNO_NOTURNO', 'Prefere o turno noturno?', 'SIM_OU_NAO')],
    grupos: [],
  },
  regras: {
    paginas: [
      {
        codigo: 'Inscricao:DADOS',
        itens: [{ fatoCodigo: 'TURNO_NOTURNO', regras: { obrigatoriedade: { tipo: 'SEMPRE' } } }],
      },
    ],
  },
};

const IGUAL_AO_LOCAL: ConferenciaComOServidor = (simulacao) => {
  const local = interpretarFormulario(simulacao.regras, simulacao);
  if (!local.valida) throw new Error('A simulação de teste deve interpretar.');
  return of(okResult(local.avaliacao));
};

const DIVERGENTE: ConferenciaComOServidor = () =>
  of(okResult({ paginas: [], campos: [], grupos: [], termos: [] }));

const RECUSADA: ConferenciaComOServidor = () =>
  of(
    errorResult(
      mockProblemDetails({
        status: 422,
        title: 'Regras recusadas',
        errors: [mockValidationError({ message: 'Primeira.', field: 'paginas[0]' })],
      }),
    ),
  );

const FALHA_SEM_LISTA: ConferenciaComOServidor = () =>
  of(errorResult(mockProblemDetails({ status: 503, title: 'Servidor fora do ar', errors: [] })));

describe('SimulacaoDeFormularioComponent: região viva da conferência', () => {
  let fixture: ComponentFixture<SimulacaoDeFormularioComponent>;

  const montar = (
    conferir: ConferenciaComOServidor,
    formulario: FormularioDoCandidato = FORMULARIO,
  ): void => {
    fixture = TestBed.createComponent(SimulacaoDeFormularioComponent);
    fixture.componentRef.setInput('formulario', formulario);
    fixture.componentRef.setInput('conferir', conferir);
    fixture.detectChanges();
  };
  const tela = (): HTMLElement => fixture.nativeElement;
  const regiao = (): HTMLElement =>
    tela().querySelector('[data-testid="anuncio-da-conferencia"]') as HTMLElement;
  const conferencia = (): HTMLElement =>
    tela().querySelector('.simulador-formulario__conferencia') as HTMLElement;
  const conferir = async (): Promise<void> => {
    const botao = [...tela().querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Conferir com o servidor',
    ) as HTMLButtonElement;
    botao.click();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const dentroDeRegiaoViva = (elemento: Element): boolean =>
    elemento.closest('[aria-live], [role="status"], [role="alert"]') !== null;

  it('a região de status já existe antes da conferência, vazia e fora do que a conferência exibe', () => {
    montar(IGUAL_AO_LOCAL);

    expect(regiao().getAttribute('role')).toBe('status');
    expect(regiao().textContent?.trim()).toBe('');
    expect(conferencia().contains(regiao())).toBe(false);
  });

  it('anuncia que está conferindo enquanto o servidor não responde', async () => {
    montar(() => NEVER);
    const mesma = regiao();
    await conferir();

    expect(regiao()).toBe(mesma);
    expect(regiao().textContent?.trim()).toBe('Conferindo com o servidor…');
  });

  it('anuncia o resultado sem divergência numa mensagem curta', async () => {
    montar(IGUAL_AO_LOCAL);
    await conferir();

    expect(regiao().textContent?.trim()).toBe('Sem divergência');
  });

  it('anuncia a divergência sem reler a tabela, que fica fora da região viva', async () => {
    montar(DIVERGENTE);
    await conferir();

    const tabela = tela().querySelector('table') as HTMLElement;
    expect(regiao().textContent?.trim()).toBe('O servidor decidiu diferente');
    expect(tabela).not.toBeNull();
    expect(dentroDeRegiaoViva(tabela)).toBe(false);
    expect(dentroDeRegiaoViva(tabela.querySelector('caption') as HTMLElement)).toBe(false);
  });

  it('anuncia o resultado e, em seguida, que as respostas mudaram durante a conferência', async () => {
    const resposta = new Subject<ApiResult<AvaliacaoDoFormulario>>();
    const enviadas: SimulacaoParaConferir[] = [];
    montar((simulacao) => {
      enviadas.push(simulacao);
      return resposta;
    }, COM_UMA_PERGUNTA);
    await conferir();
    const sim = [...tela().querySelectorAll('label')]
      .find((l) => l.textContent?.trim() === 'Sim')
      ?.querySelector('input') as HTMLInputElement;
    sim.click();
    fixture.detectChanges();

    const local = interpretarFormulario(COM_UMA_PERGUNTA.regras, enviadas[0]);
    if (!local.valida) throw new Error('A simulação de teste deve interpretar.');
    resposta.next(okResult(local.avaliacao));
    fixture.detectChanges();

    expect(regiao().textContent?.trim()).toBe(
      'Sem divergência. As respostas mudaram desde a última conferência.',
    );
  });

  it('anuncia a recusa pelo título, e a lista de recusas fica fora da região viva', async () => {
    montar(RECUSADA);
    await conferir();

    expect(regiao().textContent?.trim()).toBe('O servidor não conferiu a simulação');
    const lista = tela().querySelector('.simulador-formulario__conferencia ul') as HTMLElement;
    expect(dentroDeRegiaoViva(lista)).toBe(false);
  });

  it('anuncia a falha sem lista de recusas e a mensagem do problema não vira outra região viva', async () => {
    montar(FALHA_SEM_LISTA);
    await conferir();

    expect(regiao().textContent?.trim()).toBe('O servidor não conferiu a simulação');
    expect(conferencia().querySelector('[role="alert"], [aria-live]')).toBeNull();
  });

  it('não tem violação de acessibilidade com a divergência na tela', async () => {
    montar(DIVERGENTE);
    document.body.appendChild(tela());
    await conferir();

    const resultado = await axe.run(tela(), {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(resultado.violations.map((v) => v.id)).toEqual([]);
    tela().remove();
  });
});
