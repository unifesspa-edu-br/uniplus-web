import { TestBed } from '@angular/core/testing';
import { errorResult, mockProblemDetails, okResult } from '@uniplus/shared-core/http';
import { OrigemCandidatos, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PROCESSO_ID,
  UNIDADE_ORIGEM_ID,
  TIPO_ORIGEM_ID,
  MONTAGEM_LENTA,
  detalhe,
  montar,
  propagar,
  item,
  indiceDoPasso,
} from './processo-seletivo.retomada.testing';

describe('ProcessoSeletivoPage — retomada por endereço', MONTAGEM_LENTA, () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lê o detalhe do processo indicado pela rota', async () => {
    const cenario = montar();
    await propagar();

    expect(cenario.obter).toHaveBeenCalledWith(PROCESSO_ID);
    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);
  });

  it('abre o stepper com concluídos os passos gravados e conformes no servidor', async () => {
    const { store } = montar({
      obter: vi.fn(() => of(okResult(detalhe({ identificadorLegivel: 'ps-2027' })))),
    });
    await propagar();

    const concluidos = [...store.passosConcluidos()].sort((a, b) => a - b);
    // O detalhe grava o tipo (que nasce com o processo), o identificador e a taxa; o resto
    // está vazio e continua pendente, mesmo sem item reprovado no checklist.
    expect(concluidos).toEqual(
      ['Tipo do processo', 'Identificação', 'Pagamento'].map(indiceDoPasso),
    );
  });

  it('não dá por concluído o passo que o checklist aponta com pendência', async () => {
    const { store } = montar({
      obter: vi.fn(() => of(okResult(detalhe({ identificadorLegivel: 'ps-2027' })))),
      obterConformidade: vi.fn(() =>
        of(
          okResult({
            itens: [item('taxa_inscricao_sem_fundamento_de_isencao', 'taxa_inscricao', false)],
          }),
        ),
      ),
    });
    await propagar();

    expect(store.passosConcluidos().has(indiceDoPasso('Pagamento'))).toBe(false);
    expect(store.passosConcluidos().has(indiceDoPasso('Identificação'))).toBe(true);
  });

  it('não afirma conformidade quando o checklist não carrega', async () => {
    const { store } = montar({
      obter: vi.fn(() => of(okResult(detalhe({ identificadorLegivel: 'ps-2027' })))),
      obterConformidade: vi.fn(() => of(errorResult(mockProblemDetails({ status: 503 })))),
    });
    await propagar();

    expect(store.passosConcluidos().size).toBe(0);
    expect(store.hidratando()).toBe(false);
  });

  /**
   * As dimensões sem tela própria não podem sumir só porque o wizard
   * ainda não sabe editá-las — o snapshot guarda o agregado inteiro.
   *
   * A etapa vem completa porque a dimensão tem projeção no rascunho: o
   * adaptador confia no contrato, que declara `tipoEtapa` obrigatório, do mesmo
   * modo que lê `tipoProcesso` e `unidadeAdministradora` sem guarda. Fixture
   * parcial aqui não testaria tolerância a dado malformado — testaria o
   * adaptador contra um DTO que a API não emite.
   */
  it('preserva o detalhe canônico inteiro como snapshot remoto', async () => {
    const dto = detalhe({
      etapas: [
        {
          id: 'etapa-1',
          nome: 'Prova Objetiva',
          carater: 'classificatoria',
          tipoEtapa: {
            origemId: 'tipo-etapa-1',
            codigo: 'PROVA_OBJETIVA',
            nome: 'Prova Objetiva',
          },
          peso: 2,
          notaMinima: null,
          ordem: 1,
        },
      ] as unknown as ProcessoSeletivoDto['etapas'],
    });
    const cenario = montar({ obter: vi.fn(() => of(okResult(dto))) });
    await propagar();

    expect(cenario.store.remoteSnapshot()).toEqual(dto);
    expect(cenario.store.remoteSnapshot()?.etapas).toHaveLength(1);
  });

  it('projeta no rascunho apenas o que já tem tela', async () => {
    const cenario = montar();
    await propagar();

    const draft = cenario.store.draft();
    expect(draft.tipoProcesso.selected).toBe(TIPO_ORIGEM_ID);
    expect(draft.identificacao.nome).toBe('Vestibular 2026.1');
    expect(draft.identificacao.unidadeAdministradoraId).toBe(UNIDADE_ORIGEM_ID);
    expect(draft.identificacao.localidade).toEqual({
      codigoIbge: '1504208',
      nome: 'Marabá',
      uf: 'PA',
    });
  });

  /**
   * O vocabulário da leitura não é o da escrita: aceitar o valor cru deixaria
   * no rascunho algo que nenhuma `<option>` casa, e o campo apareceria em
   * branco num processo que declarou a origem.
   */
  it('traduz a origem dos candidatos do vocabulário da leitura', async () => {
    const cenario = montar();
    await propagar();

    expect(cenario.store.draft().identificacao.origemCandidatos).toBe('inscricaoPropria');
  });

  it('deixa a origem em branco quando o valor não é do vocabulário conhecido', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(okResult(detalhe({ origemCandidatos: OrigemCandidatos.nenhuma })))),
    });
    await propagar();

    expect(cenario.store.draft().identificacao.origemCandidatos).toBe('');
  });

  /** Retomar equivale a ter criado: o contrato não expõe atualização desses campos. */
  it('congela o cadastro inicial depois de hidratar', async () => {
    const cenario = montar();
    await propagar();

    expect(cenario.store.cadastroInicialCongelado()).toBe(true);
  });

  /**
   * O catálogo devolve só tipos ativos. Um processo criado antes de o tipo ser
   * desativado continuaria apontando para ele, e o passo 1 abriria sem seleção
   * — com o cadastro congelado, sem meio de identificar o que está lá.
   */
  it('mostra o tipo do processo mesmo fora do catálogo ativo', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.host.textContent).toContain('Vestibular');
    expect(cenario.host.textContent).toContain('Tipo não disponível no catálogo atual');
  });

  /**
   * Falha ao carregar o catálogo não pode esconder o tipo do processo: ele vem
   * do snapshot, não do catálogo, e o cadastro congelado tira do operador
   * qualquer outra forma de descobri-lo.
   */
  it('mostra o tipo do processo mesmo quando o catálogo falha', async () => {
    TestBed.resetTestingModule();
    const cenario = montar({ tiposFalham: true });
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.host.querySelector('[role=alert]')).not.toBeNull();
    expect(cenario.host.textContent).toContain('Vestibular');
  });

  /**
   * Mesmo caso do tipo, na unidade: o catálogo pode não trazê-la — por
   * remoção ou por falha na leitura — e o campo congelado abriria sem valor,
   * sem o operador saber quem administra o certame.
   */
  it('mostra a unidade administradora mesmo fora do catálogo carregado', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();

    const opcao = Array.from(
      cenario.host.querySelectorAll('#f-unidade option') as NodeListOf<HTMLOptionElement>,
    ).find((o) => o.getAttribute('value') === UNIDADE_ORIGEM_ID);

    expect(opcao?.textContent).toContain('IGE');
    expect(opcao?.textContent).toContain('Instituto de Geociências e Engenharias');
  });

  /**
   * Fecha a matriz: os dois campos que dependem de catálogo — tipo e unidade —
   * precisam mostrar o snapshot tanto quando o catálogo não traz o id quanto
   * quando o catálogo não responde. Foi por tratar esses estados isoladamente
   * que a lacuna do tipo sob erro passou despercebida.
   */
  it('mostra a unidade administradora mesmo quando o catálogo falha', async () => {
    TestBed.resetTestingModule();
    const cenario = montar({ unidadesFalham: true });
    await propagar();
    cenario.fixture.detectChanges();

    const opcao = Array.from(
      cenario.host.querySelectorAll('#f-unidade option') as NodeListOf<HTMLOptionElement>,
    ).find((o) => o.getAttribute('value') === UNIDADE_ORIGEM_ID);

    expect(opcao?.textContent).toContain('IGE');
    expect(cenario.host.querySelector('.field__erro')).not.toBeNull();
  });

  /**
   * O painel de etapas só entra no DOM depois da leitura; sem observar o fim
   * da hidratação, o foco ficaria no estado de carregamento e quem navega por
   * teclado ou leitor de tela perderia a referência.
   */
  it('devolve o foco ao título do passo depois de hidratar', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();
    await new Promise((r) => queueMicrotask(() => r(null)));

    const titulo = cenario.host.querySelector('.step-head h1');
    expect(titulo).not.toBeNull();
    expect(document.activeElement).toBe(titulo);
  });

  /**
   * Confere o elemento, não o rascunho: com `[value]` num
   * `<select>` os dois divergem — o dado chega ao estado e não chega à tela.
   * `formControlName` resolve isso, e é por isso que o teste olha o DOM.
   */
  it('exibe na tela os valores hidratados dos campos de seleção', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();
    await propagar();
    cenario.fixture.detectChanges();

    const host = cenario.host;

    expect(host.querySelector<HTMLInputElement>('#f-nome')?.value).toBe('Vestibular 2026.1');
    expect(host.querySelector<HTMLSelectElement>('#f-unidade')?.value).toBe(UNIDADE_ORIGEM_ID);
    expect(host.querySelector<HTMLSelectElement>('#f-origem')?.value).toBe('inscricaoPropria');
  });

  /**
   * O município congelado era um parágrafo solto ao lado de um botão inerte,
   * enquanto os vizinhos eram campos: quem lê a tela via um dado à deriva no
   * meio do formulário. Congelado, ele é um campo desabilitado como os outros,
   * e a ação de trocar — que não faz nada nesse estado — sai da tela.
   */
  it('mostra o município congelado como campo, sem ação de troca', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();
    await propagar();
    cenario.fixture.detectChanges();

    const municipio = cenario.host.querySelector<HTMLInputElement>('#f-localidade');
    expect(municipio?.value).toBe('Marabá — PA');
    expect(municipio?.disabled).toBe(true);
    expect(municipio?.classList.contains('input')).toBe(true);
    expect(cenario.host.textContent).not.toContain('Trocar município');
  });

  /** Campo congelado precisa mostrar o valor, não só recusar edição. */
  it('mantém o valor visível nos campos congelados após a retomada', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();
    await propagar();
    cenario.fixture.detectChanges();

    const unidade = cenario.host.querySelector<HTMLSelectElement>('#f-unidade');

    expect(unidade?.disabled).toBe(true);
    expect(unidade?.value).toBe(UNIDADE_ORIGEM_ID);
    expect(unidade?.selectedOptions[0]?.textContent).toContain('IGE');
  });

  /**
   * A configuração de taxa já gravada volta ao editor. Sem isto, retomar um
   * processo mostrava a declaração em branco — e regravar por cima apagaria o
   * que estava lá.
   */
  it('hidrata a configuração de taxa já gravada', async () => {
    const cenario = montar();
    await propagar();

    const pagamento = cenario.store.draft().pagamento;
    expect(pagamento.cobra).toBe(true);
    expect(pagamento.valor).toBe('230,00');
    expect(pagamento.fundamentos).toEqual(['CADASTRO_UNICO', 'DOACAO_MEDULA_OSSEA']);
  });

  /**
   * Ausência de configuração é "ainda não declarado", que não é o mesmo que
   * declarar que não cobra — o passo precisa continuar exigindo a declaração.
   */
  it('deixa a cobrança por declarar quando o processo nunca a declarou', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(okResult(detalhe({ configuracaoTaxaInscricao: null })))),
    });
    await propagar();

    expect(cenario.store.draft().pagamento.cobra).toBeNull();
  });
});
