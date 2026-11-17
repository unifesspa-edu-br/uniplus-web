import { TestBed } from '@angular/core/testing';
import { okResult } from '@uniplus/shared-testing';
import { BehaviorSubject, from, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CadastroInicial } from './wizard/shared/cadastro-inicial.service';
import { CatalogosDeClassificacao } from './wizard/passos/classificacao/catalogos-de-classificacao.service';
import {
  PROCESSO_ID,
  OUTRO_ID,
  MONTAGEM_LENTA,
  detalhe,
  documento,
  montar,
  propagar,
} from './processo-seletivo.retomada.testing';

describe('ProcessoSeletivoPage — troca de processo na página reusada', MONTAGEM_LENTA, () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('abrir outro processo esquece o cadastro de Peso por Área lido para o anterior', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const cenario = montar({
      id: PROCESSO_ID,
      obter: vi.fn((id: string) => of(okResult(detalhe({ id })))),
      paramMap,
    });
    await propagar();
    const catalogos = cenario.fixture.debugElement.injector.get(CatalogosDeClassificacao);
    const esquecer = vi.spyOn(catalogos, 'esquecerPesosAreaEnem');

    paramMap.next({ get: () => OUTRO_ID });
    await propagar();

    expect(esquecer).toHaveBeenCalledTimes(1);
  });

  /**
   * A `reuseKey` é simétrica, então voltar de um processo carregado para
   * `/novo` também reusa a página. Sem limpar, o operador veria o cadastro
   * anterior sob o endereço de cadastro novo — e o que preenchesse dali iria
   * para o processo errado.
   */
  it('limpa o editor ao entrar em /novo vindo de um processo carregado', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const cenario = montar({ id: PROCESSO_ID, paramMap });
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);

    paramMap.next({ get: () => null });
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBeNull();
    expect(cenario.store.remoteSnapshot()).toBeNull();
    expect(cenario.store.passoAtual()).toBe(0);
    expect(cenario.store.draft().identificacao.nome).toBe('');
  });

  /**
   * Trocar de processo com a página reusada não pode misturar os dois: o
   * detalhe não devolve anexo nem os metadados locais do edital, então
   * hidratar B por cima do rascunho de A deixaria o anexo de A atribuído a B —
   * inclusive para efeito de validação.
   */
  it('não carrega o rascunho do processo anterior ao abrir outro', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const obter = vi.fn((id: string) =>
      of(okResult(detalhe({ id, nome: id === PROCESSO_ID ? 'Processo A' : 'Processo B' }))),
    );
    const listar = vi
      .fn()
      .mockReturnValueOnce(of(okResult([documento()])))
      .mockReturnValue(of(okResult([])));

    const cenario = montar({ id: PROCESSO_ID, paramMap, obter, listarDocumentos: listar });
    await propagar();

    expect(cenario.store.draft().identificacao.uploads).toHaveLength(1);

    paramMap.next({ get: () => OUTRO_ID });
    await propagar();
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBe(OUTRO_ID);
    expect(cenario.store.draft().identificacao.nome).toBe('Processo B');
    expect(cenario.store.draft().identificacao.uploads).toHaveLength(0);
  });

  /**
   * O resumo aberto vale para o rascunho que o produziu. Confirmá-lo depois da troca resolveria o
   * passo pelo estado novo enquanto exibe os dados do editor anterior. A asserção vem na linha
   * seguinte ao `next`, sem esperar a detecção de mudanças: o efeito que zera o resumo a cada
   * troca de passo só roda depois dela, então só a limpeza do editor pode tê-lo zerado.
   */
  it('zera a confirmação pendente ao trocar de processo', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const cenario = montar({ id: PROCESSO_ID, paramMap });
    await propagar();
    cenario.store.goTo(2);
    cenario.fixture.detectChanges();
    cenario.componente.confirmacaoPendente.set({
      titulo: 'Gravar o passo',
      aviso: 'Confira os dados antes de gravar.',
      itens: [],
      rotuloDeConfirmar: 'Gravar',
    });
    expect(cenario.componente.confirmacaoPendente()).not.toBeNull();

    paramMap.next({ get: () => OUTRO_ID });

    expect(cenario.componente.confirmacaoPendente()).toBeNull();
  });

  /**
   * Duas leituras em voo podem responder fora de ordem. A antiga chegando por
   * último mostraria A sob o endereço de B — e o anexo enviado ali iria para o
   * processo errado.
   */
  it('descarta a resposta da leitura superada', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });

    const leituraA: { resolver?: (v: unknown) => void } = {};
    const obter = vi.fn((id: string) =>
      id === PROCESSO_ID
        ? from(
            new Promise((r) => {
              leituraA.resolver = r;
            }),
          )
        : of(okResult(detalhe({ id, nome: 'Processo B' }))),
    );

    const cenario = montar({ id: PROCESSO_ID, paramMap, obter });
    await propagar();

    // B entra e responde enquanto A ainda está pendente.
    paramMap.next({ get: () => OUTRO_ID });
    await propagar();
    await propagar();
    expect(cenario.store.processoSeletivoId()).toBe(OUTRO_ID);

    // A responde depois: não pode sobrescrever B.
    leituraA.resolver?.(okResult(detalhe({ id: PROCESSO_ID, nome: 'Processo A' })));
    await propagar();
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBe(OUTRO_ID);
    expect(cenario.store.draft().identificacao.nome).toBe('Processo B');
  });

  /**
   * A leitura ainda em voo não deixa rastro em `processoSeletivoId` nem em
   * `falhaDeLeitura`: sem contar `hidratando`, a resposta hidrataria o processo
   * sob `/novo` e o efeito do id levaria de volta a ele.
   */
  it('descarta a leitura pendente ao entrar em /novo', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const leitura: { resolver?: (v: unknown) => void } = {};
    const obter = vi.fn(() =>
      from(
        new Promise((r) => {
          leitura.resolver = r;
        }),
      ),
    );

    const cenario = montar({ id: PROCESSO_ID, paramMap, obter });
    await propagar();
    expect(cenario.store.hidratando()).toBe(true);

    paramMap.next({ get: () => null });
    await propagar();

    leitura.resolver?.(okResult(detalhe()));
    await propagar();
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBeNull();
    expect(cenario.store.remoteSnapshot()).toBeNull();
    expect(cenario.navigate).not.toHaveBeenCalled();
  });

  /**
   * A geração do store invalida o que o passo deixou em voo para o processo
   * anterior — sem ela, um envio que responde depois vincularia o edital de um
   * processo ao outro.
   */
  it('muda de geração ao trocar de processo e ao limpar', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const obter = vi.fn((id: string) => of(okResult(detalhe({ id }))));

    const cenario = montar({ id: PROCESSO_ID, paramMap, obter });
    await propagar();
    const inicial = cenario.store.geracao();

    paramMap.next({ get: () => OUTRO_ID });
    await propagar();
    await propagar();
    const aposTroca = cenario.store.geracao();

    paramMap.next({ get: () => null });
    await propagar();

    expect(aposTroca).not.toBe(inicial);
    expect(cenario.store.geracao()).not.toBe(aposTroca);
  });

  /**
   * Matriz de transições do editor reusado. Cada linha é um estado de partida
   * que já produziu defeito quando tratado isoladamente.
   */
  it('não leva o rascunho de /novo para um processo aberto por endereço', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => null,
    });
    const cenario = montar({ id: null, paramMap });
    await propagar();

    cenario.store.goTo(1);
    cenario.store.patchObjectSection('identificacao', { nome: 'Rascunho não salvo' });

    paramMap.next({ get: () => PROCESSO_ID });
    await propagar();
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);
    expect(cenario.store.draft().identificacao.nome).toBe('Vestibular 2026.1');
  });

  it('limpa a falha ao voltar para o processo que continua carregado', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const cenario = montar({ id: PROCESSO_ID, paramMap });
    await propagar();
    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);

    paramMap.next({ get: () => 'nao-e-uuid' });
    await propagar();
    expect(cenario.store.falhaDeLeitura()?.motivo).toBe('idInvalido');

    paramMap.next({ get: () => PROCESSO_ID });
    await propagar();

    expect(cenario.store.falhaDeLeitura()).toBeNull();
    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);
  });

  /**
   * O serviço de cadastro sobrevive à troca de endereço junto com a página, e
   * retém o comando e a `Idempotency-Key` de uma criação inconclusiva. Sem
   * esquecê-los ao limpar, o próximo envio repetiria o cadastro anterior e
   * receberia de volta o id daquele processo.
   */
  it('esquece o cadastro em andamento ao limpar o editor', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const cenario = montar({ id: PROCESSO_ID, paramMap });
    await propagar();

    const cadastro = cenario.fixture.debugElement.injector.get(CadastroInicial);
    const descartar = vi.spyOn(cadastro, 'descartarCadastroEmAndamento');

    paramMap.next({ get: () => null });
    await propagar();

    expect(descartar).toHaveBeenCalled();
  });
});
