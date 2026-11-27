import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  errorResult,
  mockCausaGeral,
  mockProblemDetails,
  mockValidationError,
  okResult,
} from '@uniplus/shared-testing';

import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import { apresentacaoDaPagina } from './formularios-de-exemplo.testing';
import { interpretarFormulario } from './interpretador/interpretador';
import {
  SimulacaoDeFormularioComponent,
  type ConferenciaComOServidor,
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

function recusado(...errors: ReturnType<typeof mockValidationError>[]) {
  return errorResult(
    mockProblemDetails({
      status: 422,
      title: 'Regras recusadas',
      detail: 'As regras têm erro.',
      errors,
    }),
  );
}

describe('SimulacaoDeFormularioComponent: recusas do servidor', () => {
  let fixture: ComponentFixture<SimulacaoDeFormularioComponent>;

  const montar = (conferir: ConferenciaComOServidor): HTMLElement => {
    fixture = TestBed.createComponent(SimulacaoDeFormularioComponent);
    fixture.componentRef.setInput('formulario', FORMULARIO);
    fixture.componentRef.setInput('conferir', conferir);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const conferir = async (tela: HTMLElement): Promise<void> => {
    const botao = [...tela.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Conferir com o servidor',
    ) as HTMLButtonElement;
    botao.click();
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const itens = (tela: HTMLElement): HTMLElement[] =>
    [...tela.querySelectorAll('.simulador-formulario__conferencia ul > li')] as HTMLElement[];

  it('lista todas as recusas, cada uma com a sua mensagem e o seu campo', async () => {
    const tela = montar(() =>
      of(
        recusado(
          mockValidationError({ message: 'Primeira.', field: 'paginas[0].itens[1]' }),
          mockValidationError({ message: 'Segunda.', field: 'paginas[2].itens[0]' }),
          mockValidationError({ message: 'Terceira.', field: 'paginas[0].itens[2]' }),
        ),
      ),
    );
    await conferir(tela);

    expect(itens(tela)).toHaveLength(3);
    expect(tela.textContent).toContain('3 recusas');
    expect(itens(tela).map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Primeira. Onde: paginas[0].itens[1]',
      'Segunda. Onde: paginas[2].itens[0]',
      'Terceira. Onde: paginas[0].itens[2]',
    ]);
  });

  it('a recusa do conjunto aparece sem a indicação do campo', async () => {
    const tela = montar(() =>
      of(
        errorResult(
          mockProblemDetails({
            status: 422,
            errors: [mockCausaGeral({ message: 'Há código repetido.' })],
          }),
        ),
      ),
    );
    await conferir(tela);

    expect(itens(tela)[0].textContent).toContain('Há código repetido.');
    expect(itens(tela)[0].textContent).not.toContain('Onde');
  });

  it('sem lista de recusas mostra o detalhe do problema, e o título quando não há detalhe', async () => {
    const comDetalhe = montar(() =>
      of(errorResult(mockProblemDetails({ status: 422, detail: 'As regras têm erro.' }))),
    );
    await conferir(comDetalhe);
    expect(comDetalhe.textContent).toContain('As regras têm erro.');
    expect(itens(comDetalhe)).toHaveLength(0);

    const semDetalhe = montar(() =>
      of(
        errorResult(mockProblemDetails({ status: 503, title: 'Servidor fora do ar', errors: [] })),
      ),
    );
    await conferir(semDetalhe);
    expect(semDetalhe.textContent).toContain('Servidor fora do ar');
  });

  it('leva o foco ao título do resumo ao terminar a conferência com recusas', async () => {
    const tela = montar(() => of(recusado(mockValidationError({ message: 'Recusa.' }))));
    await conferir(tela);

    const titulo = tela.querySelector('[role="heading"]') as HTMLElement;
    expect(document.activeElement).toBe(titulo);
  });

  it('uma nova conferência substitui o resumo anterior, com sucesso ou com outras recusas', async () => {
    const recusas = [
      recusado(mockValidationError({ message: 'Antiga.' })),
      recusado(
        mockValidationError({ message: 'Nova um.' }),
        mockValidationError({ message: 'Nova dois.' }),
      ),
    ];
    const tela = montar((simulacao) => {
      const recusa = recusas.shift();
      const local = interpretarFormulario(simulacao.regras, simulacao);
      return of(recusa ?? (local.valida ? okResult(local.avaliacao) : recusado()));
    });

    await conferir(tela);
    expect(tela.textContent).toContain('Antiga.');

    await conferir(tela);
    expect(tela.textContent).not.toContain('Antiga.');
    expect(itens(tela)).toHaveLength(2);

    await conferir(tela);
    expect(itens(tela)).toHaveLength(0);
    expect(tela.textContent).toContain('Sem divergência');
  });
});
