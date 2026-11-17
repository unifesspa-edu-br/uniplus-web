import { CenarioDoFormularioDoCandidato } from './formulario-do-candidato.testing';
import {
  CODIGO_DA_SECAO_DE_DADOS,
  FORMULARIO_COM_TERMO_DE_VERACIDADE,
  FORMULARIO_DE_DUAS_SECOES,
  FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  campoRenderizavel,
  itemDasRegras,
} from './formularios-de-exemplo.testing';

describe('FormularioDoCandidatoComponent', () => {
  let cenario: CenarioDoFormularioDoCandidato;

  beforeEach(() => {
    cenario = CenarioDoFormularioDoCandidato.preparar();
  });

  it('concluir a seção mostra a pendência do obrigatório sem resposta ao lado dele', () => {
    const tela = cenario.montar(FORMULARIO_DE_ENDERECO_COM_ALDEIA);
    expect(tela.textContent).not.toContain('Responda este campo.');

    cenario.clicar(cenario.botao('Concluir a seção'));

    expect(tela.querySelector('.field__error')?.textContent).toContain('Responda este campo.');
    expect(cenario.simulacoes.at(-1)?.etapasConcluidas).toEqual([CODIGO_DA_SECAO_DE_DADOS]);
  });

  it('concluir de novo uma seção já concluída não muda a simulação', () => {
    cenario.montar(FORMULARIO_DE_ENDERECO_COM_ALDEIA);
    cenario.clicar(cenario.botao('Concluir a seção'));
    const quantas = cenario.simulacoes.length;

    cenario.clicar(cenario.botao('Concluir a seção'));

    expect(cenario.simulacoes).toHaveLength(quantas);
  });

  it('o termo obrigatório não aceito mostra a pendência ao concluir a revisão', () => {
    const tela = cenario.montar(FORMULARIO_COM_TERMO_DE_VERACIDADE);

    cenario.clicar(cenario.botao('Concluir a seção'));
    expect(tela.textContent).toContain('Aceite o termo para concluir.');

    cenario.clicar(tela.querySelector('.formulario-candidato__termo input') as HTMLInputElement);
    expect(tela.textContent).not.toContain('Aceite o termo para concluir.');
  });

  it('o termo aceito na retomada volta marcado, e desmarcá-lo emite a lista sem ele', () => {
    const aceites: (readonly string[])[] = [];
    const tela = cenario.montar(FORMULARIO_COM_TERMO_DE_VERACIDADE, {
      termosAceitosIniciais: ['VERACIDADE'],
    });
    cenario.fixture.componentInstance.termosAceitosChange.subscribe((a) => aceites.push(a));
    const termo = tela.querySelector('.formulario-candidato__termo input') as HTMLInputElement;
    expect(termo.checked).toBe(true);

    cenario.clicar(termo);

    expect(aceites.at(-1)).toEqual([]);
  });

  it('escolher a seção em que já está leva o foco ao título na hora, e a renderização seguinte não o tira do campo', () => {
    const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES);
    const titulo = tela.querySelector('h3') as HTMLElement;
    const input = tela.querySelector('input') as HTMLInputElement;

    // Sem renderizar no clique, como quando a detecção de mudanças agrupa os eventos do quadro.
    cenario.botao('1').click();
    expect(document.activeElement).toBe(titulo);

    input.focus();
    cenario.fixture.detectChanges();

    expect(document.activeElement).toBe(input);
  });

  it('a última seção conclui por padrão; quem hospeda a ação final tira o botão dela', () => {
    cenario.montar(FORMULARIO_DE_DUAS_SECOES);
    cenario.clicar(cenario.botao('Próxima seção'));
    expect(cenario.botao('Concluir a seção')).toBeDefined();

    cenario.montar(FORMULARIO_DE_DUAS_SECOES, { concluirNaUltimaSecao: false });
    expect(cenario.botao('Próxima seção')).toBeDefined();
    cenario.clicar(cenario.botao('Próxima seção'));
    expect(cenario.botao('Concluir a seção')).toBeUndefined();
    expect(cenario.botao('Seção anterior')).toBeDefined();
  });

  describe('com a seção válida exigida para avançar', () => {
    const emailPreenchido = (tela: HTMLElement): void =>
      cenario.digitar(
        tela.querySelector('input[type="text"], input:not([type])') as HTMLInputElement,
        'a@b.br',
      );

    it('não avança com pergunta obrigatória pendente: fica na seção, com o foco na pergunta', () => {
      const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES, { exigirSecaoValida: true });

      cenario.clicar(cenario.botao('Próxima seção'));

      expect(cenario.botao('1').getAttribute('aria-current')).toBe('step');
      expect(document.activeElement?.tagName).toBe('INPUT');
      expect(tela.textContent).toContain('Há 1 item a corrigir na seção Contato.');
    });

    it('na última seção, concluir também barra com pergunta obrigatória pendente', () => {
      const tela = cenario.montar(
        {
          ...FORMULARIO_DE_DUAS_SECOES,
          etapas: [FORMULARIO_DE_DUAS_SECOES.etapas[0]],
          regras: { etapas: FORMULARIO_DE_DUAS_SECOES.regras.etapas?.slice(0, 1) },
        },
        { exigirSecaoValida: true },
      );

      cenario.clicar(cenario.botao('Concluir a seção'));

      expect(tela.textContent).toContain('Há 1 item a corrigir na seção Contato.');
    });

    it('avança quando a seção está respondida', () => {
      const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES, { exigirSecaoValida: true });
      emailPreenchido(tela);

      cenario.clicar(cenario.botao('Próxima seção'));

      expect(cenario.botao('2').getAttribute('aria-current')).toBe('step');
    });

    it('o indicador de passos não pula uma seção pendente, mas volta sempre', () => {
      const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES, { exigirSecaoValida: true });

      cenario.clicar(cenario.botao('2'));
      expect(cenario.botao('1').getAttribute('aria-current')).toBe('step');

      emailPreenchido(tela);
      cenario.clicar(cenario.botao('2'));
      expect(cenario.botao('2').getAttribute('aria-current')).toBe('step');

      cenario.clicar(cenario.botao('Seção anterior'));
      expect(cenario.botao('1').getAttribute('aria-current')).toBe('step');
    });

    it('sem a exigência — a simulação do administrador — avança com pendência', () => {
      cenario.montar(FORMULARIO_DE_DUAS_SECOES);

      cenario.clicar(cenario.botao('Próxima seção'));

      expect(cenario.botao('2').getAttribute('aria-current')).toBe('step');
    });

    it('lista as pendências por seção sem dar nenhuma como concluída', () => {
      cenario.montar(FORMULARIO_DE_DUAS_SECOES);

      expect(cenario.fixture.componentInstance.pendenciasPorSecao()).toEqual([
        { chave: expect.any(String), titulo: 'Contato', quantidade: 1 },
        { chave: expect.any(String), titulo: 'Nome', quantidade: 1 },
      ]);
    });
  });

  it('a seção concluída com pendência aparece com o estado de erro, e não como concluída', () => {
    cenario.montar(FORMULARIO_DE_DUAS_SECOES);

    cenario.clicar(cenario.botao('Próxima seção'));

    expect(cenario.itemDoPasso('1').classList).toContain('is-error');
    expect(cenario.itemDoPasso('1').classList).not.toContain('is-done');
  });

  it('ir à pendência da seção põe o foco no campo que falta sem concluir nada', async () => {
    const tela = cenario.montar(FORMULARIO_DE_DUAS_SECOES);
    const chaveDoNome = cenario.fixture.componentInstance.pendenciasPorSecao()[1].chave;

    cenario.fixture.componentInstance.irAPendenciaDe(chaveDoNome);
    cenario.fixture.detectChanges();
    await cenario.fixture.whenStable();

    expect(tela.querySelector('h3')?.textContent).toContain('Nome');
    const input = tela.querySelector('input') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(tela.querySelector(`#${input.getAttribute('aria-describedby')}`)?.textContent).toContain(
      'Responda este campo.',
    );
    expect(cenario.simulacoes.at(-1)?.etapasConcluidas ?? []).toEqual([]);
    expect(cenario.itemDoPasso('2').classList).not.toContain('is-done');
  });

  it('concluir a seção esconde o destino: o avanço para na seção que ficou no lugar dele', () => {
    const tela = cenario.montar(
      {
        ...FORMULARIO_DE_DUAS_SECOES,
        etapas: [
          {
            codigo: 'A',
            codigoNasRegras: 'Inscricao:A',
            ordem: 0,
            tipo: 'SECAO',
            titulo: 'Seção A',
          },
          {
            codigo: 'B',
            codigoNasRegras: 'Inscricao:B',
            ordem: 1,
            tipo: 'SECAO',
            titulo: 'Seção B',
          },
          {
            codigo: 'C',
            codigoNasRegras: 'Inscricao:C',
            ordem: 2,
            tipo: 'SECAO',
            titulo: 'Seção C',
          },
          {
            codigo: 'D',
            codigoNasRegras: 'Inscricao:D',
            ordem: 3,
            tipo: 'SECAO',
            titulo: 'Seção D',
          },
        ],
        fatosColetados: [
          campoRenderizavel('TEM_BOLSA', 'Tem bolsa', 'TEXTO'),
          campoRenderizavel('APELIDO', 'Apelido', 'TEXTO', { ordem: 1 }),
          campoRenderizavel('EMAIL', 'E-mail', 'TEXTO', { ordem: 2 }),
        ],
        regras: {
          etapas: [
            {
              codigo: 'Inscricao:A',
              itens: [itemDasRegras('TEM_BOLSA', { obrigatoriedade: 'NUNCA' })],
            },
            {
              codigo: 'Inscricao:B',
              exibicao: [[{ fato: 'BOLSISTA', operador: 'DIFERENTE', valor: false }]],
            },
            {
              codigo: 'Inscricao:C',
              itens: [itemDasRegras('APELIDO', { obrigatoriedade: 'NUNCA' })],
            },
            { codigo: 'Inscricao:D', itens: [itemDasRegras('EMAIL')] },
          ],
          derivacoes: [
            {
              fatoCodigo: 'BOLSISTA',
              booleano: true,
              regras: [{ quando: [[{ fato: 'TEM_BOLSA', operador: 'IGUAL', valor: 'SIM' }]] }],
            },
          ],
        },
      },
      { exigirSecaoValida: true },
    );
    expect(tela.textContent).toContain('Seção B');

    cenario.clicar(cenario.botao('Próxima seção'));

    expect(tela.textContent).not.toContain('Seção B');
    expect(tela.querySelector('h3')?.textContent).toContain('Seção C');
  });

  it('o link da pendência que só aparece com o opcional em branco conclui a seção até revelá-la e foca o campo', async () => {
    const tela = cenario.montar({
      ...FORMULARIO_DE_DUAS_SECOES,
      fatosColetados: [
        campoRenderizavel('TEM_BOLSA', 'Tem bolsa', 'TEXTO'),
        campoRenderizavel('JUSTIFICATIVA', 'Justificativa', 'TEXTO', { ordem: 1 }),
      ],
      regras: {
        etapas: [
          {
            codigo: 'Inscricao:CONTATO',
            itens: [
              itemDasRegras('TEM_BOLSA', { obrigatoriedade: 'NUNCA' }),
              itemDasRegras('JUSTIFICATIVA', {
                exibicao: [[{ fato: 'BOLSISTA', operador: 'IGUAL', valor: false }]],
              }),
            ],
          },
          { codigo: 'Inscricao:NOME', itens: [] },
        ],
        derivacoes: [
          {
            fatoCodigo: 'BOLSISTA',
            booleano: true,
            regras: [{ quando: [[{ fato: 'TEM_BOLSA', operador: 'IGUAL', valor: 'SIM' }]] }],
          },
        ],
      },
    });
    expect(tela.textContent).not.toContain('Justificativa');
    // O motivo do envio já conta o obrigatório que concluir vai mostrar, antes do clique.
    expect(cenario.fixture.componentInstance.pendenciasPorSecao().map((s) => s.quantidade)).toEqual(
      [1],
    );

    const { chave } = cenario.fixture.componentInstance.pendenciasPorSecao()[0];

    cenario.fixture.componentInstance.irAPendenciaDe(chave);
    cenario.fixture.detectChanges();
    await cenario.fixture.whenStable();

    expect(document.activeElement).toBe(tela.querySelector('[data-campo="JUSTIFICATIVA"] input'));
    expect(cenario.itemDoPasso('1').classList).toContain('is-error');
    expect(cenario.itemDoPasso('1').classList).not.toContain('is-done');
  });
});
