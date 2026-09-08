import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { AtendimentoStepComponent } from './atendimento.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000009aa';
const ROTA_ATENDIMENTO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/oferta-atendimento`;

const PCD_ID = '01960000-0000-7000-0000-0000000000d1';
const OUTRA_CONDICAO_ID = '01960000-0000-7000-0000-0000000000d2';
const RECURSO_ID = '01960000-0000-7000-0000-0000000000e1';
const TIPO_ID = '01960000-0000-7000-0000-0000000000f1';

const CONDICOES = [
  { id: PCD_ID, codigo: 'PCD', nome: 'Pessoa com deficiência', descricao: null, criadoEm: '2026-09-01T00:00:00Z' },
  { id: OUTRA_CONDICAO_ID, codigo: 'LACTANTE', nome: 'Lactante', descricao: null, criadoEm: '2026-09-01T00:00:00Z' },
];
const RECURSOS = [
  { id: RECURSO_ID, nome: 'Ledor', descricao: 'Auxílio para leitura', criadoEm: '2026-09-01T00:00:00Z' },
];
const TIPOS_DEFICIENCIA = [
  {
    id: TIPO_ID,
    codigo: 'VISUAL',
    nome: 'Deficiência visual',
    descricao: 'Cegueira ou baixa visão',
    permanente: true,
    criadoEm: '2026-09-01T00:00:00Z',
  },
];

describe('AtendimentoStepComponent', () => {
  let componente: AtendimentoStepComponent;
  let fixture: ComponentFixture<AtendimentoStepComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let elemento: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AtendimentoStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AtendimentoStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    elemento = fixture.nativeElement as HTMLElement;
    detectar = () => fixture.detectChanges();

    detectar();
    responderCatalogos();
    detectar();

    store.processoSeletivoId.set(PROCESSO_ID);
  });

  afterEach(() => controller.verify());

  function responderCatalogos(): void {
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('condicoes-atendimento')) requisicao.flush(CONDICOES);
      else if (url.includes('recursos-acessibilidade')) requisicao.flush(RECURSOS);
      else if (url.includes('tipos-deficiencia')) requisicao.flush(TIPOS_DEFICIENCIA);
      else requisicao.flush([]);
    }
  }

  it('carrega os três catálogos e exibe as condições', () => {
    expect(elemento.textContent).toContain('Pessoa com deficiência');
    expect(elemento.textContent).toContain('Lactante');
    expect(elemento.textContent).toContain('Ledor');
  });

  it('não exibe a seção de tipos de deficiência sem a condição PcD marcada', () => {
    expect(elemento.textContent).not.toContain('Tipos de deficiência reconhecidos');
  });

  it('marcar a condição PCD revela a seção de tipos de deficiência', () => {
    componente.toggleCondicao(CONDICOES[0], true);
    detectar();

    expect(elemento.textContent).toContain('Tipos de deficiência reconhecidos');
    expect(store.draft().atendimento.condicoes).toEqual([
      { id: PCD_ID, codigo: 'PCD', nome: 'Pessoa com deficiência' },
    ]);
  });

  it('desmarcar a condição PCD esvazia os tipos de deficiência já marcados', () => {
    componente.toggleCondicao(CONDICOES[0], true);
    componente.toggleTipoDeficiencia(TIPOS_DEFICIENCIA[0], true);
    detectar();
    expect(store.draft().atendimento.tiposDeficiencia).toHaveLength(1);

    componente.toggleCondicao(CONDICOES[0], false);
    detectar();

    expect(store.draft().atendimento.condicoes).toEqual([]);
    expect(store.draft().atendimento.tiposDeficiencia).toEqual([]);
  });

  /**
   * Espelha o achado de revisão em `removerCondicaoInativa()`: desmarcar uma
   * condição PcD só pode esvaziar os tipos de deficiência quando, depois da
   * desmarcação, não resta nenhuma outra condição de código PcD marcada — se
   * o operador tinha uma condição PcD hidratada (inativa) e marcou também a
   * ativa, desmarcar a ativa não pode apagar uma seleção que o pré-requisito
   * do ADR-0067 ainda sustenta.
   */
  it('não esvazia os tipos de deficiência ao desmarcar uma condição PcD quando outra condição PcD segue marcada', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-antigo-pcd', codigo: 'PCD', nome: 'Pessoa com deficiência (antiga)' }],
    });
    componente.toggleCondicao(CONDICOES[0], true);
    componente.toggleTipoDeficiencia(TIPOS_DEFICIENCIA[0], true);
    detectar();

    componente.toggleCondicao(CONDICOES[0], false);
    detectar();

    expect(store.draft().atendimento.condicoes).toEqual([
      { id: 'id-antigo-pcd', codigo: 'PCD', nome: 'Pessoa com deficiência (antiga)' },
    ]);
    expect(store.draft().atendimento.tiposDeficiencia).toEqual([
      { id: TIPO_ID, nome: 'Deficiência visual' },
    ]);
  });

  it('recusa validar tipo de deficiência sem a condição PcD marcada', () => {
    // Estado que a tela não deveria produzir sozinha (o toggle da condição já
    // esvazia), mas o rascunho pode chegar assim por hidratação de um
    // processo editado por outro caminho — validate() precisa recusar mesmo
    // assim.
    store.patchObjectSection('atendimento', {
      tiposDeficiencia: [{ id: TIPO_ID, nome: 'Deficiência visual' }],
    });

    const resultado = componente.validate();

    expect(resultado.valid).toBe(false);
  });

  it('grava condicaoIds, recursoIds e tipoDeficienciaIds', async () => {
    componente.toggleCondicao(CONDICOES[0], true);
    componente.toggleRecurso(RECURSOS[0], true);
    componente.toggleTipoDeficiencia(TIPOS_DEFICIENCIA[0], true);
    detectar();

    const gravacao = componente.persistir();

    const requisicao = controller.expectOne(ROTA_ATENDIMENTO);
    expect(requisicao.request.method).toBe('PUT');
    expect(requisicao.request.body).toEqual({
      condicaoIds: [PCD_ID],
      recursoIds: [RECURSO_ID],
      tipoDeficienciaIds: [TIPO_ID],
    });
    expect(requisicao.request.headers.get('Idempotency-Key')).toBeTruthy();

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  it('grava listas vazias quando nada está selecionado (CA-05)', async () => {
    const gravacao = componente.persistir();

    const requisicao = controller.expectOne(ROTA_ATENDIMENTO);
    expect(requisicao.request.body).toEqual({
      condicaoIds: [],
      recursoIds: [],
      tipoDeficienciaIds: [],
    });

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  it('preserva o rascunho quando a API recusa', async () => {
    componente.toggleCondicao(CONDICOES[0], true);
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_ATENDIMENTO).flush(
      {
        type: 'about:blank',
        title: 'Tipo de deficiência sem condição PcD.',
        status: 422,
        code: 'uniplus.selecao.oferta_atendimento.tipo_deficiencia_sem_condicao_pcd',
        traceId: 'trace-1',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(store.draft().atendimento.condicoes).toHaveLength(1);
  });

  it('limpa o erro de gravação anterior ao trocar de processo', async () => {
    componente.toggleCondicao(CONDICOES[0], true);
    componente.toggleTipoDeficiencia(TIPOS_DEFICIENCIA[0], true);
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_ATENDIMENTO).flush(
      { type: 'about:blank', title: 'Recusado.', status: 422, traceId: 't' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await gravacao;
    expect(componente.erroDeGravacao()).not.toBeNull();

    store.geracao.update((valor) => valor + 1);
    detectar();

    expect(componente.erroDeGravacao()).toBeNull();
  });

  /**
   * Reproduz o achado de revisão: a condição PcD segue marcada no rascunho,
   * mas o catálogo ativo não a tem mais (inativada, ou falhou ao carregar) —
   * `pcdSelecionada()` não pode depender do catálogo, senão a seção de tipos
   * de deficiência some sem que o operador tenha como corrigir pela tela.
   *
   * Isso não torna o registro gravável do jeito que está: a mesma condição
   * inativa também aparece em `condicoesInativas()`, e o
   * `DefinirOfertaAtendimentoCommandHandler` recusaria o id dela com 422 —
   * `validate()` precisa dizer isso antes da ida ao servidor, nomeando a
   * condição, sem esconder a seção de tipos de deficiência que o operador
   * ainda precisa revisar.
   */
  it('mantém a seção de tipos de deficiência visível, mas recusa gravar enquanto a condição PcD estiver inativa', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-antigo-pcd', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      tiposDeficiencia: [{ id: TIPO_ID, nome: 'Deficiência visual' }],
    });
    detectar();

    expect(componente.pcdSelecionada()).toBe(true);
    expect(elemento.textContent).toContain('Tipos de deficiência reconhecidos');

    const resultado = componente.validate();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Pessoa com deficiência'))).toBe(true);
  });

  it('remover a condição PcD inativa também esvazia os tipos de deficiência', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-antigo-pcd', codigo: 'PCD', nome: 'Pessoa com deficiência (antiga)' }],
      tiposDeficiencia: [{ id: TIPO_ID, nome: 'Deficiência visual' }],
    });
    detectar();

    componente.removerCondicaoInativa('id-antigo-pcd');
    detectar();

    expect(store.draft().atendimento.condicoes).toEqual([]);
    expect(store.draft().atendimento.tiposDeficiencia).toEqual([]);
  });

  /**
   * Reproduz o achado de revisão: se o operador já marcou a condição PcD
   * ativa que substituiu a inativa (mesmo código, id novo), o pré-requisito
   * do ADR-0067 continua satisfeito depois da remoção — esvaziar os tipos
   * de deficiência apagaria uma seleção válida sem motivo, só porque a
   * condição removida também era codificada como PCD.
   */
  it('não esvazia os tipos de deficiência ao remover a condição PcD inativa quando outra condição PcD segue marcada', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [
        { id: 'id-antigo-pcd', codigo: 'PCD', nome: 'Pessoa com deficiência (antiga)' },
        { id: PCD_ID, codigo: 'PCD', nome: 'Pessoa com deficiência' },
      ],
      tiposDeficiencia: [{ id: TIPO_ID, nome: 'Deficiência visual' }],
    });
    detectar();

    componente.removerCondicaoInativa('id-antigo-pcd');
    detectar();

    expect(store.draft().atendimento.condicoes).toEqual([
      { id: PCD_ID, codigo: 'PCD', nome: 'Pessoa com deficiência' },
    ]);
    expect(store.draft().atendimento.tiposDeficiencia).toEqual([
      { id: TIPO_ID, nome: 'Deficiência visual' },
    ]);
  });

  it('recusa gravar antes de o processo existir', async () => {
    store.processoSeletivoId.set(null);

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_ATENDIMENTO);
  });

  it('mantém referência inativa visível e permite removê-la', () => {
    // Simula hidratação de um recurso que já saiu do cadastro ativo.
    store.patchObjectSection('atendimento', {
      recursos: [{ id: 'id-antigo', nome: 'Recurso descontinuado' }],
    });
    detectar();

    expect(elemento.textContent).toContain('Recurso descontinuado');
    expect(elemento.textContent).toContain('Inativo no cadastro');

    componente.removerRecursoInativo('id-antigo');
    detectar();

    expect(store.draft().atendimento.recursos).toEqual([]);
  });

  /**
   * Reproduz o achado de revisão: uma falha ao carregar qualquer catálogo de
   * Configuração substituía a tela inteira pelo erro, mesmo com o rascunho
   * já tendo os nomes de condição, recurso e tipo de deficiência (populados
   * por `hidratarDraft()` a partir de `dto.ofertaAtendimento`) — o operador
   * não conseguia inspecionar a oferta persistida durante uma
   * indisponibilidade de catálogo, que é exatamente o cenário para o qual
   * os snapshots embutidos existem.
   *
   * "Inativo no cadastro" também não pode aparecer aqui: sem catálogo
   * carregado, não há como confirmar se o item realmente saiu de lá —
   * "Catálogo indisponível" é o que a tela sabe de fato.
   */
  it('mostra as seleções já gravadas ao lado do erro de catálogo, sem tratá-las como inativas', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'id-recurso-gravado', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'id-tipo-gravado', nome: 'Deficiência visual' }],
    });
    detectar();

    componente.catalogos.erro.set(
      'Não foi possível carregar os catálogos de ofertas, modalidades e regras. Tente novamente.',
    );
    detectar();

    expect(elemento.querySelector('button')?.textContent).toContain('Tentar novamente');
    expect(elemento.textContent).toContain('Pessoa com deficiência');
    expect(elemento.textContent).toContain('Ledor');
    expect(elemento.textContent).toContain('Deficiência visual');
    expect(elemento.textContent).toContain('Catálogo indisponível');
    expect(elemento.textContent).not.toContain('Inativo no cadastro');
  });

  /**
   * Reproduz o achado mais grave da revisão: com o catálogo indisponível,
   * `condicoesInativas()`/`recursosInativos()`/`tiposDeficienciaInativos()`
   * comparam contra um catálogo ativo vazio — não porque nada está ativo,
   * mas porque a tela ainda não sabe — e a validação (introduzida para
   * recusar referência genuinamente inativa) classificava TODA seleção
   * gravada como inativa, mandando o operador apagar uma oferta válida e
   * inalterada por causa de uma indisponibilidade temporária. Seguir a
   * instrução esvaziaria as três listas e apagaria a oferta ao gravar.
   */
  it('não recusa nem propõe remoção de um rascunho hidratado quando o catálogo está indisponível', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'id-recurso-gravado', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'id-tipo-gravado', nome: 'Deficiência visual' }],
    });
    detectar();

    componente.catalogos.erro.set(
      'Não foi possível carregar os catálogos de ofertas, modalidades e regras. Tente novamente.',
    );
    detectar();

    expect(componente.validate()).toEqual({ valid: true });
  });

  /** Mesmo caso acima, mas durante o carregamento inicial — antes de qualquer resposta chegar. */
  it('não recusa nem propõe remoção de um rascunho hidratado enquanto o catálogo ainda está carregando', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'id-recurso-gravado', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'id-tipo-gravado', nome: 'Deficiência visual' }],
    });
    componente.catalogos.carregando.set(true);
    detectar();

    expect(componente.validate()).toEqual({ valid: true });
  });

  /**
   * A interação completa que a revisão pediu: catálogo indisponível com
   * rascunho hidratado não bloqueia o avanço, não propõe remoção de nada, e
   * a gravação segue as listas como estão no rascunho — nunca vazias por
   * omissão da indisponibilidade do catálogo.
   */
  it('grava as listas do rascunho hidratado como estão, mesmo com o catálogo indisponível', async () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'id-recurso-gravado', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'id-tipo-gravado', nome: 'Deficiência visual' }],
    });
    detectar();

    componente.catalogos.erro.set(
      'Não foi possível carregar os catálogos de ofertas, modalidades e regras. Tente novamente.',
    );
    detectar();

    const gravacao = componente.persistir();

    const requisicao = controller.expectOne(ROTA_ATENDIMENTO);
    expect(requisicao.request.body).toEqual({
      condicaoIds: ['id-condicao-gravada'],
      recursoIds: ['id-recurso-gravado'],
      tipoDeficienciaIds: ['id-tipo-gravado'],
    });

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  /**
   * Reproduz o achado de revisão sobre a própria correção anterior: fechar
   * `validate()` atrás de `catalogoConfirmado()` impede que a tela *mande*
   * apagar a oferta, mas os checkboxes de remoção continuavam habilitados —
   * o operador ainda *conseguia* desmarcar um item sem querer, sem opção de
   * catálogo que o restaure, e o próximo avanço persistiria a lista
   * reduzida. Nenhum controle que muta as três listas pode ficar habilitado
   * enquanto a tela não sabe distinguir "saiu do cadastro" de "não sei
   * ainda" — nem os de marcar/desmarcar (vazios nesse estado, mas por
   * defesa), nem os de remover referência inativa. E as seleções gravadas
   * seguem visíveis tanto carregando quanto em falha (achado seguinte, na
   * mesma linha): esconder tudo atrás de "Carregando…" seria o mesmo beco
   * sem saída do estado de erro, só que na porta de entrada.
   */
  it('desabilita todos os controles que mutam as três listas enquanto o catálogo carrega ou falha', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'id-recurso-gravado', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'id-tipo-gravado', nome: 'Deficiência visual' }],
    });
    detectar();

    function checkboxes(): HTMLInputElement[] {
      return [...elemento.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    }

    // Ainda carregando: o rascunho gravado segue visível (achado seguinte),
    // mas nenhum controle pode ficar disponível para alterá-lo.
    componente.catalogos.carregando.set(true);
    detectar();
    expect(checkboxes().length).toBeGreaterThan(0);
    expect(checkboxes().every((input) => input.disabled)).toBe(true);

    // Falha de carga: a tela volta a mostrar o rascunho gravado (achado
    // anterior), mas nenhum controle pode ficar disponível para alterá-lo.
    componente.catalogos.carregando.set(false);
    componente.catalogos.erro.set(
      'Não foi possível carregar os catálogos de ofertas, modalidades e regras. Tente novamente.',
    );
    detectar();
    expect(checkboxes().length).toBeGreaterThan(0);
    expect(checkboxes().every((input) => input.disabled)).toBe(true);

    // Catálogo confirmado: os controles voltam a ficar disponíveis.
    componente.catalogos.erro.set(null);
    detectar();
    expect(checkboxes().length).toBeGreaterThan(0);
    expect(checkboxes().every((input) => input.disabled)).toBe(false);
  });

  /**
   * Reproduz o achado de revisão: a correção do estado de carregamento faz
   * as seleções hidratadas renderizarem enquanto `carregando()` é `true` —
   * mas o catálogo ativo ainda está vazio nesse momento, então
   * `rotuloDeSituacaoInativa()` não pode dizer "Inativo no cadastro" (uma
   * afirmação que só o catálogo carregado sustenta). "Ainda não sei" não é
   * "não existe mais", nem no rótulo.
   */
  it('não rotula como "Inativo no cadastro" uma seleção hidratada enquanto o catálogo ainda está carregando', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
    });
    detectar();

    componente.catalogos.carregando.set(true);
    detectar();

    expect(componente.rotuloDeSituacaoInativa()).not.toBe('Inativo no cadastro');
    expect(elemento.textContent).not.toContain('Inativo no cadastro');
    expect(elemento.textContent).toContain('Pessoa com deficiência');
  });

  /**
   * A interação completa: catálogo em falha com rascunho hidratado não
   * bloqueia o avanço, não deixa nenhum controle disponível para alterar as
   * listas sem querer, e a gravação segue exatamente o que o rascunho já
   * tinha.
   */
  it('catálogo em falha com rascunho hidratado: controles desabilitados e avanço permitido sem alterar as listas', async () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-condicao-gravada', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      recursos: [{ id: 'id-recurso-gravado', nome: 'Ledor' }],
      tiposDeficiencia: [{ id: 'id-tipo-gravado', nome: 'Deficiência visual' }],
    });
    detectar();

    componente.catalogos.erro.set(
      'Não foi possível carregar os catálogos de ofertas, modalidades e regras. Tente novamente.',
    );
    detectar();

    const checkboxes = [...elemento.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(checkboxes.length).toBeGreaterThan(0);
    expect(checkboxes.every((input) => input.disabled)).toBe(true);

    expect(componente.validate()).toEqual({ valid: true });

    const gravacao = componente.persistir();
    const requisicao = controller.expectOne(ROTA_ATENDIMENTO);
    expect(requisicao.request.body).toEqual({
      condicaoIds: ['id-condicao-gravada'],
      recursoIds: ['id-recurso-gravado'],
      tipoDeficienciaIds: ['id-tipo-gravado'],
    });

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  /**
   * Reproduz o achado de revisão: o `DefinirOfertaAtendimentoCommandHandler`
   * resolve cada id no cadastro vivo e recusa com 422 quando uma referência
   * já saiu de lá — sem este diagnóstico local, "Gravar e avançar" falharia
   * sempre que o rascunho guardasse uma referência inativa, e nada na tela
   * apontaria qual item é a causa.
   */
  it('recusa validar com referência inativa marcada, nomeando o item, sem chamar o servidor', async () => {
    store.patchObjectSection('atendimento', {
      recursos: [{ id: 'id-antigo', nome: 'Recurso descontinuado' }],
    });
    detectar();

    const resultado = componente.validate();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Recurso descontinuado'))).toBe(true);

    const gravacao = await componente.persistir();
    expect(gravacao.valid).toBe(false);
    controller.expectNone(ROTA_ATENDIMENTO);
  });

  /** As três listas acumulam pendências — não é só a primeira encontrada. */
  it('nomeia todas as referências inativas de uma vez, em mais de uma lista', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-antigo-lact', codigo: 'LACTANTE', nome: 'Lactante (antiga)' }],
      recursos: [
        { id: 'id-antigo-r1', nome: 'Recurso A' },
        { id: 'id-antigo-r2', nome: 'Recurso B' },
      ],
    });
    detectar();

    const resultado = componente.validate();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Lactante (antiga)'))).toBe(true);
    expect(resultado.messages?.some((m) => m.includes('Recurso A') && m.includes('Recurso B'))).toBe(
      true,
    );
  });

  it('marca a condição pelo checkbox real da tela, no DOM', () => {
    const checkbox = [...elemento.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(
      (input) => input.closest('label')?.textContent?.includes('Pessoa com deficiência'),
    );
    if (checkbox === undefined) throw new Error('Checkbox da condição PcD não encontrado.');

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    detectar();

    expect(store.draft().atendimento.condicoes.map((item) => item.id)).toContain(PCD_ID);
  });
});
