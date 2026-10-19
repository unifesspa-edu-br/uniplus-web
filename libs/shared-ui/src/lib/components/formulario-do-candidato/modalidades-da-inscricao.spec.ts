import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
import { BUSCA_DE_CEP } from '../endereco-geo/endereco-geo.model';

import { FormularioDoCandidatoComponent } from './formulario-do-candidato';
import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import type { AvaliacaoNaTela, ModalidadesAvaliadas } from './modalidades-avaliadas';

/**
 * O bloco de modalidades mostra o que a API calculou das respostas (ADR-0143): a lista, o que falta
 * responder ou que nenhuma se aplica, e leva às perguntas e às seções que decidem.
 */
const FORMULARIO: FormularioDoCandidato = {
  finalidade: 'INSCRICAO',
  etapas: [
    {
      codigo: 'CONTATO',
      codigoNasRegras: 'Inscricao:CONTATO',
      ordem: 0,
      tipo: 'SECAO',
      titulo: 'Contato',
    },
    {
      codigo: 'RESERVA',
      codigoNasRegras: 'Inscricao:RESERVA',
      ordem: 1,
      tipo: 'SECAO',
      titulo: 'Reserva de vagas',
    },
    {
      codigo: 'MODALIDADES',
      codigoNasRegras: null,
      ordem: 2,
      tipo: 'BLOCO',
      bloco: 'MODALIDADES_CALCULADAS',
      titulo: 'Modalidades de concorrência',
    },
    {
      codigo: 'REVISAO',
      codigoNasRegras: null,
      ordem: 3,
      tipo: 'BLOCO',
      bloco: 'REVISAO_E_ACEITE',
      titulo: 'Revisão e aceite',
    },
  ],
  termos: [],
  grupos: [],
  fatosColetados: [
    { fatoCodigo: 'EMAIL', ordem: 0, rotulo: 'E-mail', tipoRenderizacao: 'TEXTO' },
    {
      fatoCodigo: 'CONCORRER_EP',
      ordem: 1,
      rotulo: 'Deseja concorrer às vagas de escola pública?',
      tipoRenderizacao: 'TEXTO',
    },
  ],
  regras: {
    etapas: [
      {
        codigo: 'Inscricao:CONTATO',
        itens: [{ fatoCodigo: 'EMAIL', obrigatoriedade: 'SEMPRE', restricoes: [] }],
      },
      {
        codigo: 'Inscricao:RESERVA',
        itens: [{ fatoCodigo: 'CONCORRER_EP', obrigatoriedade: 'SEMPRE', restricoes: [] }],
      },
    ],
  },
  dependenciasDaAvaliacao: { fatos: ['CONCORRER_EP'], grupos: [] },
};

const AMPLA = { codigo: 'AC', nome: 'Ampla concorrência', ordem: 0 };
const ESCOLA_PUBLICA = { codigo: 'LI_EP', nome: 'Escola pública, sem renda', ordem: 1 };

const modalidades = (outros: Partial<ModalidadesAvaliadas>): ModalidadesAvaliadas => ({
  derivada: true,
  situacao: 'CONCORRE',
  itens: [],
  pendencias: [],
  ...outros,
});
const naTela = (
  m: ModalidadesAvaliadas,
  outros: Partial<AvaliacaoNaTela> = {},
): AvaliacaoNaTela => ({
  modalidades: m,
  documentos: null,
  calculando: false,
  erro: null,
  ...outros,
});

describe('Bloco de modalidades da inscrição', () => {
  let fixture: ComponentFixture<FormularioDoCandidatoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [] }) },
        { provide: BUSCA_DE_CEP, useValue: () => of({ ok: false }) },
      ],
    });
  });

  const montar = (avaliacao: AvaliacaoNaTela | null): HTMLElement => {
    fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    fixture.componentRef.setInput('formulario', FORMULARIO);
    fixture.componentRef.setInput('avaliacao', avaliacao);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const botao = (tela: HTMLElement, texto: string): HTMLButtonElement =>
    [...tela.querySelectorAll('button')].find((b) =>
      b.textContent?.trim().startsWith(texto),
    ) as HTMLButtonElement;
  const irParaASecao = (tela: HTMLElement, titulo: string): void => {
    botao(tela, String(passos(tela).indexOf(titulo) + 1)).click();
    fixture.detectChanges();
  };
  const passos = (tela: HTMLElement): string[] =>
    [...tela.querySelectorAll('ui-steps .ui-steps__botao')].map((b) =>
      (b.textContent ?? '').replace(/^\s*\d+/, '').trim(),
    );
  const bloco = (tela: HTMLElement): HTMLElement =>
    tela.querySelector('ui-modalidades-da-inscricao') as HTMLElement;

  it('sem avaliação da API, como no simulador, o bloco só explica que o sistema calcula', () => {
    const tela = montar(null);
    irParaASecao(tela, 'Modalidades de concorrência');

    expect(bloco(tela)).toBeNull();
    expect(tela.textContent).toContain('são calculadas pelo sistema a partir das respostas dadas');
  });

  it('concorrendo, lista os nomes na ordem da oferta, sem código, e diz que o envio confirma', () => {
    const tela = montar(naTela(modalidades({ itens: [ESCOLA_PUBLICA, AMPLA] })));
    irParaASecao(tela, 'Modalidades de concorrência');

    const itens = [...bloco(tela).querySelectorAll('ul li')].map((li) => li.textContent?.trim());
    expect(itens).toEqual(['Ampla concorrência', 'Escola pública, sem renda']);
    expect(bloco(tela).textContent).not.toContain('LI_EP');
    expect(bloco(tela).textContent).toContain('O envio da inscrição confirma as modalidades.');
  });

  it('faltando responder, a pergunta pendente leva o foco ao campo dela, na seção dela', async () => {
    const tela = montar(
      naTela(
        modalidades({
          situacao: 'FALTA_RESPONDER',
          pendencias: [
            {
              fatoCodigo: 'CONCORRER_EP',
              rotulo: 'Deseja concorrer às vagas de escola pública?',
              secaoCodigo: 'Inscricao:RESERVA',
            },
          ],
        }),
      ),
    );
    irParaASecao(tela, 'Modalidades de concorrência');

    botao(bloco(tela), 'Deseja concorrer às vagas de escola pública?').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(tela.querySelector('h3')?.textContent).toContain('Reserva de vagas');
    expect(document.activeElement).toBe(tela.querySelector('[data-campo="CONCORRER_EP"] input'));
  });

  it('sem nenhuma modalidade, avisa que o envio será recusado e leva só às seções que as definem', () => {
    const tela = montar(naTela(modalidades({ situacao: 'NAO_CONCORRE' })));
    irParaASecao(tela, 'Modalidades de concorrência');

    expect(bloco(tela).textContent).toContain('a inscrição não poderá ser enviada assim');
    expect(botao(bloco(tela), 'Conferir Contato')).toBeUndefined();

    botao(bloco(tela), 'Conferir Reserva de vagas').click();
    fixture.detectChanges();

    expect(tela.querySelector('h3')?.textContent).toContain('Reserva de vagas');
  });

  it('com 2ª opção, lista as modalidades de cada opção sob o curso dela', () => {
    const tela = montar(
      naTela(modalidades({ itens: [AMPLA, ESCOLA_PUBLICA] }), {
        modalidadesSegundaOpcao: modalidades({ itens: [AMPLA] }),
        opcoesDeCurso: { primeira: 'Direito', segunda: 'Engenharia da Computação' },
      }),
    );
    irParaASecao(tela, 'Modalidades de concorrência');

    const titulos = [...bloco(tela).querySelectorAll('h4')].map((h) => h.textContent?.trim());
    const listas = [...bloco(tela).querySelectorAll('ul li')].map((li) => li.textContent?.trim());
    expect(titulos).toEqual(['1ª opção — Direito', '2ª opção — Engenharia da Computação']);
    expect(listas).toEqual([
      'Ampla concorrência',
      'Escola pública, sem renda',
      'Ampla concorrência',
    ]);
  });

  it('sem nenhuma modalidade na 2ª opção, só ela avisa e a 1ª segue com a lista', () => {
    const tela = montar(
      naTela(modalidades({ itens: [AMPLA] }), {
        modalidadesSegundaOpcao: modalidades({ situacao: 'NAO_CONCORRE' }),
        opcoesDeCurso: { primeira: 'Direito', segunda: 'Engenharia da Computação' },
      }),
    );
    irParaASecao(tela, 'Modalidades de concorrência');

    const blocos = bloco(tela).querySelectorAll('.modalidades-da-inscricao__opcao');
    expect(blocos[0].textContent).toContain('Ampla concorrência');
    expect(blocos[1].textContent).toContain(
      'nenhuma das modalidades ofertadas nesta opção de curso',
    );
    expect(botao(bloco(tela), 'Conferir Reserva de vagas')).toBeDefined();
  });

  it('a pendência que a 2ª opção repete da 1ª aparece uma vez só', () => {
    const pendencia = {
      fatoCodigo: 'CONCORRER_EP',
      rotulo: 'Deseja concorrer às vagas de escola pública?',
      secaoCodigo: 'Inscricao:RESERVA',
    };
    const faltando = modalidades({ situacao: 'FALTA_RESPONDER', pendencias: [pendencia] });
    const tela = montar(naTela(faltando, { modalidadesSegundaOpcao: faltando }));
    irParaASecao(tela, 'Modalidades de concorrência');

    expect(
      [...bloco(tela).querySelectorAll('button')].filter((b) =>
        b.textContent?.includes('Deseja concorrer'),
      ),
    ).toHaveLength(1);
    expect(
      bloco(tela).querySelectorAll('.modalidades-da-inscricao__opcao')[1].textContent,
    ).toContain('Depende das mesmas respostas pedidas na 1ª opção.');
  });

  it('o processo que não define as modalidades pela inscrição não mostra a seção delas', () => {
    const tela = montar(naTela(modalidades({ derivada: false, situacao: null })));

    expect(passos(tela)).not.toContain('Modalidades de concorrência');
  });

  it('calculando, mantém a lista e marca o bloco ocupado; com erro, oferece tentar de novo', () => {
    const tela = montar(naTela(modalidades({ itens: [AMPLA] }), { calculando: true }));
    irParaASecao(tela, 'Modalidades de concorrência');

    expect(bloco(tela).getAttribute('aria-busy')).toBe('true');
    expect(bloco(tela).textContent).toContain('Ampla concorrência');

    let pedidos = 0;
    fixture.componentInstance.tentarAvaliarDeNovo.subscribe(() => pedidos++);
    fixture.componentRef.setInput(
      'avaliacao',
      naTela(modalidades({ itens: [AMPLA] }), { erro: 'Não foi possível atualizar agora.' }),
    );
    fixture.detectChanges();
    botao(bloco(tela), 'Tentar de novo').click();

    expect(bloco(tela).textContent).toContain('Não foi possível atualizar agora.');
    expect(pedidos).toBe(1);
  });

  it('a Revisão resume as modalidades e leva às seções que as definem', () => {
    const tela = montar(naTela(modalidades({ itens: [AMPLA] })));
    irParaASecao(tela, 'Revisão e aceite');

    expect(bloco(tela).textContent).toContain('Ampla concorrência');
    expect(botao(bloco(tela), 'Conferir Reserva de vagas')).toBeDefined();
  });

  it('a mudança atravessa a pendência: o conjunto novo é comparado com o de antes dela', () => {
    const tela = montar(naTela(modalidades({ itens: [AMPLA] })));

    fixture.componentRef.setInput(
      'avaliacao',
      naTela(modalidades({ situacao: 'FALTA_RESPONDER' })),
    );
    fixture.detectChanges();
    fixture.componentRef.setInput(
      'avaliacao',
      naTela(modalidades({ itens: [AMPLA, ESCOLA_PUBLICA] })),
    );
    fixture.detectChanges();

    const regioes = [...tela.querySelectorAll('[aria-live="polite"]')].map((r) => r.textContent);
    expect(regioes).toContain('Você passou a concorrer em: Escola pública, sem renda.');
  });

  it('a mudança do conjunto é anunciada pelos nomes, sem levar o foco', () => {
    const tela = montar(naTela(modalidades({ itens: [AMPLA] })));
    const foco = document.activeElement;

    fixture.componentRef.setInput(
      'avaliacao',
      naTela(modalidades({ itens: [AMPLA, ESCOLA_PUBLICA] })),
    );
    fixture.detectChanges();

    const regioes = [...tela.querySelectorAll('[aria-live="polite"]')].map((r) => r.textContent);
    expect(regioes).toContain('Você passou a concorrer em: Escola pública, sem renda.');
    expect(document.activeElement).toBe(foco);
  });
});
