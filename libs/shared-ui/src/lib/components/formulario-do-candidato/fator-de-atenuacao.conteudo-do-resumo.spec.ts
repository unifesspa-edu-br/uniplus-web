import {
  CAMINHO_DO_FATOR,
  CenarioDaRevisaoDoFator,
  FATO_FORA_DO_FATOR,
  MUNICIPIO_DO_FATOR,
  SOLICITA_O_FATOR,
  comOGrupo,
  formularioComOFator,
  formularioSemOFator,
} from './fator-de-atenuacao.testing';

describe('Resumo do Fator de Atenuação na Revisão', () => {
  let cenario: CenarioDaRevisaoDoFator;

  beforeEach(() => (cenario = CenarioDaRevisaoDoFator.preparar()));
  afterEach(() => cenario.encerrar());

  it('com o Fator pedido, mostra Sim, o caminho e o município pelo nome, sem código', () => {
    cenario.abrirNaRevisao(formularioComOFator(), {
      respostas: {
        [SOLICITA_O_FATOR]: true,
        [CAMINHO_DO_FATOR]: 'RESIDENCIA',
        [MUNICIPIO_DO_FATOR]: '2105302',
      },
    });

    const texto = cenario.resumo()?.textContent ?? '';
    expect(texto).toContain('Sim');
    expect(texto).toContain('Residência no período do edital');
    expect(texto).toContain('Imperatriz — MA');
    expect(texto).not.toContain('2105302');
    expect(cenario.resumo()?.querySelector('section[aria-labelledby]')).not.toBeNull();
  });

  it('mostra os campos na ordem do formulário, não na ordem das dependências', () => {
    cenario.abrirNaRevisao(formularioComOFator(), {
      respostas: {
        [SOLICITA_O_FATOR]: true,
        [CAMINHO_DO_FATOR]: 'RESIDENCIA',
        [MUNICIPIO_DO_FATOR]: '2105302',
      },
    });

    const rotulos = [...(cenario.resumo()?.querySelectorAll('dt') ?? [])].map(
      (dt) => dt.textContent,
    );
    expect(rotulos).toEqual([
      'Deseja solicitar o Fator?',
      'Por qual vínculo com a área você solicita o Fator?',
      'Em qual município você residiu?',
    ]);
  });

  it('o link do resumo volta à seção em que o candidato respondeu', () => {
    cenario.abrirNaRevisao(formularioComOFator(), { respostas: { [SOLICITA_O_FATOR]: true } });

    (cenario.resumo()?.querySelector('button') as HTMLButtonElement).click();
    cenario.fixture.detectChanges();

    expect(cenario.tela.querySelector('h3')?.textContent).toContain('Fator de Atenuação');
  });

  it('com o Fator recusado, o campo que a regra oculta não aparece, mesmo com resposta antiga', () => {
    cenario.abrirNaRevisao(formularioComOFator(), {
      respostas: { [SOLICITA_O_FATOR]: false, [CAMINHO_DO_FATOR]: 'RESIDENCIA' },
    });

    const texto = cenario.resumo()?.textContent ?? '';
    expect(texto).toContain('Não');
    expect(texto).not.toContain('Residência no período do edital');
  });

  it('só entra o que as dependências do Fator listam, nada fixo no código', () => {
    cenario.abrirNaRevisao(formularioComOFator({ fatos: [CAMINHO_DO_FATOR], grupos: [] }), {
      respostas: {
        [SOLICITA_O_FATOR]: true,
        [CAMINHO_DO_FATOR]: 'RESIDENCIA',
        [FATO_FORA_DO_FATOR]: 'texto livre',
      },
    });

    const texto = cenario.resumo()?.textContent ?? '';
    expect(texto).toContain('Residência no período do edital');
    expect(texto).not.toContain('Deseja solicitar o Fator?');
    expect(texto).not.toContain('texto livre');
  });

  it.each([
    ['sem dependências', null],
    ['com a lista vazia', { fatos: [], grupos: [] }],
  ])('%s, o resumo não aparece', (_, dependencias) => {
    cenario.abrirNaRevisao(formularioComOFator(dependencias), {
      respostas: { [SOLICITA_O_FATOR]: true },
    });

    expect(cenario.resumo()).toBeNull();
  });

  it('o formulário que não pergunta pelo Fator não mostra o resumo', () => {
    cenario.abrirNaRevisao(formularioSemOFator(), { respostas: { EMAIL: 'a@b.c' } });

    expect(cenario.resumo()).toBeNull();
  });

  it('os campos de grupo que o Fator lista aparecem por ocorrência respondida, com o título dela', () => {
    const dependencias = { fatos: ['FAMILIA.BONUS', 'FAMILIA.RENDA'], grupos: ['FAMILIA'] };
    cenario.abrirNaRevisao(comOGrupo(formularioComOFator(dependencias)), {
      respostas: {},
      grupos: {
        FAMILIA: [
          { id: 'a', respostas: { RENDA: 1500.5, NOME: 'Maria', BONUS: 7 } },
          { id: 'b', respostas: { RENDA: 800, NOME: 'João', BONUS: 9 } },
        ],
      },
    });

    const itens = [...(cenario.resumo()?.querySelectorAll('dt, dd') ?? [])].map((e) =>
      e.textContent?.trim(),
    );
    expect(itens).toEqual([
      'Integrante da família (Integrante 1): Renda',
      '1.500,5',
      'Integrante da família (Integrante 2): Renda',
      '800',
    ]);
    // NOME não está nas dependências; BONUS está, mas a regra o oculta nas duas ocorrências.
    const texto = cenario.resumo()?.textContent ?? '';
    expect(texto).not.toContain('Maria');
    expect(texto).not.toContain('Nome');
    expect(texto).not.toContain('Bônus');
  });

  it('os subitens do grupo seguem a ordem do grupo, não a da regra', () => {
    const comRendaDepois = comOGrupo(
      formularioComOFator({ fatos: ['FAMILIA.RENDA', 'FAMILIA.NOME'], grupos: ['FAMILIA'] }),
    );
    cenario.abrirNaRevisao(
      {
        ...comRendaDepois,
        grupos: comRendaDepois.grupos.map((grupo) => ({
          ...grupo,
          subitens: grupo.subitens.map((s) => (s.fatoCodigo === 'RENDA' ? { ...s, ordem: 5 } : s)),
        })),
      },
      {
        respostas: {},
        grupos: { FAMILIA: [{ id: 'a', respostas: { RENDA: 10, NOME: 'Maria' } }] },
      },
    );

    const rotulos = [...(cenario.resumo()?.querySelectorAll('dt') ?? [])].map((e) =>
      e.textContent?.trim(),
    );
    expect(rotulos).toEqual([
      'Integrante da família (Integrante 1): Nome',
      'Integrante da família (Integrante 1): Renda',
    ]);
  });
});
