import { CenarioDoFormularioDoCandidato } from './formulario-do-candidato.testing';
import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import {
  CODIGO_DA_SECAO_DE_DADOS,
  FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS,
  FORMULARIO_DE_DUAS_SECOES,
  FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  apresentacaoDaPagina,
  grupoDasRegras,
  campoApresentado,
  itemDasRegras,
} from './formularios-de-exemplo.testing';

const ALDEIA_E_UMA_SECAO_DEPOIS: FormularioDoCandidato = {
  ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  paginas: [
    ...FORMULARIO_DE_ENDERECO_COM_ALDEIA.paginas,
    {
      codigo: 'FINAL',
      codigoNasRegras: 'Inscricao:FINAL',
      ordem: 1,
      tipo: 'SECAO',
      apresentacao: apresentacaoDaPagina('Final'),
    },
  ],
  regras: {
    paginas: [
      ...(FORMULARIO_DE_ENDERECO_COM_ALDEIA.regras.paginas ?? []),
      { codigo: 'Inscricao:FINAL', itens: [] },
    ],
  },
};

const NOTA_COM_MINIMO: FormularioDoCandidato = {
  ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  coleta: { itens: [campoApresentado('NOTA', 'Nota', 'NUMERO')], grupos: [] },
  regras: {
    paginas: [
      {
        codigo: CODIGO_DA_SECAO_DE_DADOS,
        itens: [itemDasRegras('NOTA', { restricoes: [{ tipo: 'FAIXA_NUMERICA', minimo: 0.5 }] })],
      },
    ],
  },
};

const NASCIMENTO_ATE_O_ENVIO: FormularioDoCandidato = {
  ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  coleta: { itens: [campoApresentado('NASCIMENTO', 'Data de nascimento', 'DATA')], grupos: [] },
  regras: {
    paginas: [
      {
        codigo: CODIGO_DA_SECAO_DE_DADOS,
        itens: [
          itemDasRegras('NASCIMENTO', {
            restricoes: [
              {
                tipo: 'FAIXA_DE_DATA',
                dataMaxima: { ancora: 'ENVIO', anos: 0, dias: 0 },
              },
            ],
          }),
        ],
      },
    ],
  },
};

const FAMILIA_COM_DUAS_OCORRENCIAS_NO_MINIMO: FormularioDoCandidato = {
  ...FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS,
  coleta: {
    itens: [],
    grupos: [
      {
        ...FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS.coleta.grupos[0],
        ocorrencias: { minimo: 2, maximo: 3, incluiCandidato: false },
      },
    ],
  },
};

const FAMILIA_COM_NASCIMENTO_OPCIONAL: FormularioDoCandidato = {
  ...FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS,
  coleta: {
    itens: [],
    grupos: [
      {
        ...FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS.coleta.grupos[0],
        subitens: [campoApresentado('NASCIMENTO', 'Data de nascimento', 'DATA')],
      },
    ],
  },
  regras: {
    paginas: [
      {
        codigo: CODIGO_DA_SECAO_DE_DADOS,
        grupos: [
          grupoDasRegras('FAMILIA', [
            itemDasRegras('NASCIMENTO', {
              obrigatoriedade: { tipo: 'NUNCA' },
              restricoes: [
                { tipo: 'FAIXA_DE_DATA', dataMaxima: { ancora: 'ENVIO', anos: 0, dias: 0 } },
              ],
            }),
          ]),
        ],
      },
    ],
  },
};

/** A profissão vem antes da renda na tela, mas depois dela nas regras. */
const FAMILIA_COM_ORDEM_DA_TELA_DIFERENTE: FormularioDoCandidato = {
  ...FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS,
  coleta: {
    itens: [],
    grupos: [
      {
        ...FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS.coleta.grupos[0],
        subitens: [
          campoApresentado('RENDA', 'Renda', 'NUMERO', { ordem: 1 }),
          campoApresentado('PROFISSAO', 'Profissão', 'TEXTO', { ordem: 0 }),
        ],
      },
    ],
  },
};

describe('FormularioDoCandidatoComponent: perguntas que faltam', () => {
  let cenario: CenarioDoFormularioDoCandidato;

  const perguntasQueFaltam = (): string[] =>
    [...cenario.tela.querySelectorAll('.alert li')].map((li) => li.textContent?.trim() ?? '');

  const avisosNaTela = (): string[] =>
    [...cenario.tela.querySelectorAll('.alert, [aria-live]')].map((e) => e.textContent ?? '');

  const tentarAvancarComAldeia = (formulario = FORMULARIO_DE_ENDERECO_COM_ALDEIA): void => {
    cenario.montar(formulario, { exigirSecaoValida: true });
    cenario.clicar(cenario.opcao('Aldeia'));
    cenario.clicar(cenario.botao(formulario.paginas.length > 1 ? 'Próxima seção' : 'Concluir'));
  };

  beforeEach(() => {
    cenario = CenarioDoFormularioDoCandidato.preparar();
  });

  it('lista o texto da pergunta que só apareceu depois de uma resposta e leva o foco a ela', () => {
    tentarAvancarComAldeia();

    expect(perguntasQueFaltam()).toEqual(['Nome da aldeia']);
    expect(cenario.tela.textContent).toContain('Falta responder 1 pergunta desta seção');
    expect(document.activeElement?.closest('[data-campo]')?.getAttribute('data-campo')).toBe(
      'NOME_ALDEIA',
    );
  });

  it('lista todas as perguntas de um grupo sem resposta, na ordem da tela, com o foco na primeira', () => {
    const tela = cenario.montar(FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS, {
      exigirSecaoValida: true,
    });
    cenario.clicar(cenario.botao('Acrescentar'));

    cenario.clicar(cenario.botao('Concluir'));

    expect(perguntasQueFaltam()).toEqual(['Renda (Integrante 1)', 'Profissão (Integrante 1)']);
    expect(document.activeElement).toBe(tela.querySelector('insc-grupo-do-candidato input'));
  });

  it('a pergunta que sai com "Não" sai da lista, e "Próxima seção" avança', () => {
    tentarAvancarComAldeia(ALDEIA_E_UMA_SECAO_DEPOIS);

    cenario.clicar(cenario.opcao('Urbano'));
    cenario.clicar(cenario.botao('Próxima seção'));

    expect(perguntasQueFaltam()).toEqual([]);
    expect(cenario.botao('2').getAttribute('aria-current')).toBe('step');
  });

  it('"Próxima seção" barrada lista a pergunta sem resposta da seção', () => {
    cenario.montar(FORMULARIO_DE_DUAS_SECOES, { exigirSecaoValida: true });

    cenario.clicar(cenario.botao('Próxima seção'));

    expect(perguntasQueFaltam()).toEqual(['E-mail']);
  });

  it('a lista só aparece depois de tentar avançar', () => {
    cenario.montar(FORMULARIO_DE_ENDERECO_COM_ALDEIA, { exigirSecaoValida: true });
    cenario.clicar(cenario.opcao('Aldeia'));

    expect(perguntasQueFaltam()).toEqual([]);
  });

  it('a resposta preenchida que a regra recusa não é pergunta sem resposta', () => {
    cenario.montar(NOTA_COM_MINIMO, { exigirSecaoValida: true });
    cenario.digitar(cenario.tela.querySelector('input') as HTMLInputElement, '0,4');

    cenario.clicar(cenario.botao('Concluir'));

    expect(perguntasQueFaltam()).toEqual([]);
    expect(cenario.tela.textContent).not.toContain('Falta responder');
    expect(cenario.itemDoPasso('1').classList).toContain('is-error');
    expect(cenario.itemDoPasso('1').textContent).not.toContain('sem resposta');
  });

  it('nenhum aviso repete a resposta dada', () => {
    tentarAvancarComAldeia();

    for (const texto of avisosNaTela()) expect(texto).not.toMatch(/ALDEIA|Aldeia/);
  });

  it('a data preenchida cujo limite depende do envio não é pergunta sem resposta', () => {
    cenario.montar(NASCIMENTO_ATE_O_ENVIO, { exigirSecaoValida: true });
    cenario.digitar(cenario.tela.querySelector('input') as HTMLInputElement, '2000-05-05');

    cenario.clicar(cenario.botao('Concluir'));

    expect(cenario.tela.textContent).toContain('Há 1 item a corrigir na seção Dados.');
    expect(perguntasQueFaltam()).toEqual([]);
    expect(cenario.itemDoPasso('1').textContent).not.toContain('sem resposta');
  });

  it('o grupo fora da quantidade mínima de ocorrências também lista as perguntas sem resposta', () => {
    cenario.montar(FAMILIA_COM_DUAS_OCORRENCIAS_NO_MINIMO, { exigirSecaoValida: true });
    cenario.clicar(cenario.botao('Acrescentar'));

    cenario.clicar(cenario.botao('Concluir'));

    expect(perguntasQueFaltam()).toEqual(['Renda (Integrante 1)', 'Profissão (Integrante 1)']);
    expect(cenario.itemDoPasso('1').textContent).toContain('(com pergunta sem resposta)');
  });

  it('o grupo já preenchido cujo estado depende do envio não é grupo sem resposta', () => {
    cenario.montar(FAMILIA_COM_NASCIMENTO_OPCIONAL, {
      exigirSecaoValida: true,
      inicial: { grupos: { FAMILIA: [{ id: 'm1', respostas: { NASCIMENTO: '2000-05-05' } }] } },
    });

    cenario.clicar(cenario.botao('Concluir'));

    expect(cenario.tela.textContent).toContain('Há 1 item a corrigir na seção Dados.');
    expect(perguntasQueFaltam()).toEqual([]);
  });

  it('identifica a ocorrência em cada pergunta sem resposta, sem repetir o texto', () => {
    cenario.montar(FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS, { exigirSecaoValida: true });
    cenario.clicar(cenario.botao('Acrescentar'));
    cenario.clicar(cenario.botao('Acrescentar'));

    cenario.clicar(cenario.botao('Concluir'));

    expect(perguntasQueFaltam()).toEqual([
      'Renda (Integrante 1)',
      'Profissão (Integrante 1)',
      'Renda (Integrante 2)',
      'Profissão (Integrante 2)',
    ]);
  });

  it('lista os subitens na ordem da tela, e o foco vai ao primeiro', () => {
    const tela = cenario.montar(FAMILIA_COM_ORDEM_DA_TELA_DIFERENTE, { exigirSecaoValida: true });
    cenario.clicar(cenario.botao('Acrescentar'));

    cenario.clicar(cenario.botao('Concluir'));

    expect(perguntasQueFaltam()).toEqual(['Profissão (Integrante 1)', 'Renda (Integrante 1)']);
    expect(document.activeElement).toBe(tela.querySelector('insc-grupo-do-candidato input'));
  });

  it('conta cada pergunta pendente de um grupo, no aviso falado e no que se emite', () => {
    cenario.montar(FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS, { exigirSecaoValida: true });
    cenario.clicar(cenario.botao('Acrescentar'));

    cenario.clicar(cenario.botao('Concluir'));

    expect(cenario.tela.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Há 2 itens a corrigir na seção Dados.',
    );
    expect(cenario.fixture.componentInstance.pendenciasPorSecao().map((s) => s.quantidade)).toEqual(
      [2],
    );
  });

  describe('aviso de pergunta nova', () => {
    const avisoDaRegiaoViva = (): string | null | undefined =>
      cenario.tela.querySelector('[aria-live="polite"]')?.textContent;

    it('diz que apareceu pergunta nova de resposta obrigatória', () => {
      cenario.montar(FORMULARIO_DE_ENDERECO_COM_ALDEIA);

      cenario.clicar(cenario.opcao('Aldeia'));

      expect(avisoDaRegiaoViva()).toContain(
        'Apareceu: Nome da aldeia. Pergunta nova de resposta obrigatória.',
      );
    });

    it('vale também para o subitem de grupo, dito uma vez por texto', () => {
      cenario.montar(FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS);

      cenario.clicar(cenario.botao('Acrescentar'));

      expect(avisoDaRegiaoViva()).toBe(
        'Apareceu: Renda, Profissão. Pergunta nova de resposta obrigatória.',
      );
    });

    it('não repete o aviso quando a pessoa responde a pergunta que apareceu', () => {
      cenario.montar(FORMULARIO_DE_ENDERECO_COM_ALDEIA);
      cenario.clicar(cenario.opcao('Aldeia'));

      cenario.digitar(
        cenario.tela.querySelector('[data-campo="NOME_ALDEIA"] input') as HTMLInputElement,
        'Aldeia Nova',
      );

      expect(avisoDaRegiaoViva()).toBe('');
    });

    it('não diz que há pergunta nova quando só some pergunta', () => {
      cenario.montar(FORMULARIO_DE_ENDERECO_COM_ALDEIA);
      cenario.clicar(cenario.opcao('Aldeia'));

      cenario.clicar(cenario.opcao('Urbano'));

      expect(avisoDaRegiaoViva()).toBe('Saiu: Nome da aldeia.');
    });
  });

  describe('indicador da seção', () => {
    it('diz que há pergunta sem resposta, e não resposta recusada', () => {
      tentarAvancarComAldeia();

      const item = cenario.itemDoPasso('1');
      expect(item.classList).toContain('is-error');
      expect(item.textContent).toContain('(com pergunta sem resposta)');
      expect(item.textContent).not.toContain('com resposta recusada');
    });

    it('diz que há resposta recusada quando o servidor a recusou', async () => {
      cenario.montar(FORMULARIO_DE_DUAS_SECOES);
      cenario.fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'NOME_SOCIAL', mensagem: 'Informe nome e sobrenome.' },
      ]);
      cenario.fixture.detectChanges();
      await cenario.fixture.whenStable();

      expect(cenario.itemDoPasso('2').textContent).toContain('(com resposta recusada)');
      expect(cenario.itemDoPasso('2').textContent).not.toContain('com pergunta sem resposta');
    });
  });
});
