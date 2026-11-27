import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { apresentacaoDoCampo } from '@uniplus/shared-inscricao/formulario';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { comInscricao, item } from '../formulario/formulario-de-inscricao.testing';
import { AtendimentoPassoComponent } from './atendimento.component';
import {
  CONDICOES,
  PCD_ID,
  RECURSOS,
  RECURSO_ID,
  ROTA_ATENDIMENTO,
  TIPOS_DEFICIENCIA,
  TIPO_ID,
  montarPassoDeAtendimento,
} from './atendimento.component.testing';

describe('AtendimentoPassoComponent', () => {
  let componente: AtendimentoPassoComponent;
  let fixture: ComponentFixture<AtendimentoPassoComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let elemento: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    ({ fixture, store, controller } = await montarPassoDeAtendimento());
    componente = fixture.componentInstance;
    elemento = fixture.nativeElement as HTMLElement;
    detectar = () => fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  it('carrega os três catálogos e exibe as condições', () => {
    expect(elemento.textContent).toContain('Pessoa com deficiência');
    expect(elemento.textContent).toContain('Lactante');
    expect(elemento.textContent).toContain('Ledor');
  });

  it('com a condição PcD cadastrada e desmarcada, a seção orienta a marcá-la', () => {
    expect(elemento.textContent).toContain('Tipos de deficiência reconhecidos');
    expect(elemento.querySelector('#atend-aviso-pcd-desmarcada')?.textContent).toContain(
      'Marque a condição "Pessoa com deficiência"',
    );
    expect(elemento.querySelector('#atend-aviso-sem-pcd')).toBeNull();
    expect(elemento.textContent).not.toContain('Deficiência visual');
  });

  it('sem a condição PcD no cadastro, a seção nomeia o que falta e onde cadastrar', () => {
    componente.catalogos.condicoes.set([CONDICOES[1]]);
    detectar();

    expect(elemento.textContent).toContain('Tipos de deficiência reconhecidos');
    const aviso = elemento.querySelector('#atend-aviso-sem-pcd')?.textContent ?? '';
    expect(aviso).toContain('Pessoa com deficiência');
    expect(aviso).toContain('PCD');
    expect(aviso).toContain('Configuração → Condições de atendimento');
    expect(elemento.querySelector('#atend-aviso-pcd-desmarcada')).toBeNull();
  });

  it('sem a condição PcD no cadastro, o formulário que pergunta o tipo de deficiência não trava o passo', () => {
    componente.catalogos.condicoes.set([CONDICOES[1]]);
    store.patchObjectSection(
      'formulario',
      comInscricao(store.draft().formulario, {
        titulo: null,
        paginas: [],
        itens: [
          item('TIPO_DEFICIENCIA', 0, 'S1', {
            apresentacao: apresentacaoDoCampo('Tipo de deficiência', 'ESCOLHA_UNICA'),
          }),
        ],
        termos: [],
        pressupostos: [],
        grupos: [],
      }),
    );
    detectar();

    const resultado = componente.validar();

    // O tipo de deficiência oferece os tipos do cadastro, com ou sem oferta (UNI-REQ-0012).
    expect(componente.pcdAusenteDoCadastro()).toBe(true);
    expect(resultado.valid).toBe(true);
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
   * Em `retirarCondicaoDaOferta()`, desmarcar uma
   * condição PcD só pode esvaziar os tipos de deficiência quando, depois da
   * desmarcação, não resta nenhuma outra condição de código PcD marcada — se
   * o operador tinha uma condição PcD hidratada (removida) e marcou também a
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
    // processo editado por outro caminho — validar() precisa recusar mesmo
    // assim.
    store.patchObjectSection('atendimento', {
      tiposDeficiencia: [{ id: TIPO_ID, nome: 'Deficiência visual' }],
    });

    const resultado = componente.validar();

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

  it('grava listas vazias quando nada está selecionado', async () => {
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

  it('recusa a condição PcD sem tipo de deficiência antes de gravar (ADR-0067)', async () => {
    componente.toggleCondicao(CONDICOES[0], true);
    detectar();

    expect(componente.validar().messages).toContain(
      'A condição "Pessoa com deficiência" exige ao menos um tipo de deficiência marcado. Marque um tipo ou desmarque a condição.',
    );
    const resultado = await componente.persistir();
    controller.expectNone(ROTA_ATENDIMENTO);
    expect(resultado.valid).toBe(false);
    expect(store.draft().atendimento.condicoes).toHaveLength(1);
  });

  it('preserva o rascunho quando a API recusa', async () => {
    componente.toggleCondicao(CONDICOES[0], true);
    componente.toggleTipoDeficiencia(TIPOS_DEFICIENCIA[0], true);
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_ATENDIMENTO).flush(
      {
        type: 'about:blank',
        title: 'Recusado.',
        status: 422,
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
    controller
      .expectOne(ROTA_ATENDIMENTO)
      .flush(
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
   * A condição PcD segue marcada no rascunho,
   * mas o catálogo ativo não a tem mais (removida, ou falhou ao carregar) —
   * `pcdSelecionada()` não pode depender do catálogo, senão a seção de tipos
   * de deficiência some sem que o operador tenha como corrigir pela tela.
   *
   * Isso não torna o registro gravável do jeito que está: a mesma condição
   * removida também aparece em `condicoesRemovidas()`, e o
   * `DefinirAtendimentoEspecializadoCommandHandler` recusaria o id dela com 422 —
   * `validar()` precisa dizer isso antes da ida ao servidor, nomeando a
   * condição, sem esconder a seção de tipos de deficiência que o operador
   * ainda precisa revisar.
   */
  it('mantém a seção de tipos de deficiência visível, mas recusa gravar enquanto a condição PcD estiver removida', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-antigo-pcd', codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      tiposDeficiencia: [{ id: TIPO_ID, nome: 'Deficiência visual' }],
    });
    detectar();

    expect(componente.pcdSelecionada()).toBe(true);
    expect(elemento.textContent).toContain('Tipos de deficiência reconhecidos');

    const resultado = componente.validar();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Pessoa com deficiência'))).toBe(true);
  });

  it('remover a condição PcD removida também esvazia os tipos de deficiência', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-antigo-pcd', codigo: 'PCD', nome: 'Pessoa com deficiência (antiga)' }],
      tiposDeficiencia: [{ id: TIPO_ID, nome: 'Deficiência visual' }],
    });
    detectar();

    componente.retirarCondicaoDaOferta('id-antigo-pcd');
    detectar();

    expect(store.draft().atendimento.condicoes).toEqual([]);
    expect(store.draft().atendimento.tiposDeficiencia).toEqual([]);
  });

  /**
   * Se o operador já marcou a condição PcD
   * ativa que substituiu a removida (mesmo código, id novo), o pré-requisito
   * do ADR-0067 continua satisfeito depois da remoção — esvaziar os tipos
   * de deficiência apagaria uma seleção válida sem motivo, só porque a
   * condição removida também era codificada como PCD.
   */
  it('não esvazia os tipos de deficiência ao remover a condição PcD removida quando outra condição PcD segue marcada', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [
        { id: 'id-antigo-pcd', codigo: 'PCD', nome: 'Pessoa com deficiência (antiga)' },
        { id: PCD_ID, codigo: 'PCD', nome: 'Pessoa com deficiência' },
      ],
      tiposDeficiencia: [{ id: TIPO_ID, nome: 'Deficiência visual' }],
    });
    detectar();

    componente.retirarCondicaoDaOferta('id-antigo-pcd');
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

  /** Em consulta a oferta gravada aparece como texto, com o nome que o rascunho guarda. */
  it('em consulta, lista a oferta gravada como texto, sem caixa de seleção', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: PCD_ID, codigo: 'PCD', nome: 'Pessoa com deficiência' }],
      tiposDeficiencia: [{ id: 'id-antigo', nome: 'Tipo já removido' }],
      recursos: [],
    });
    store.remoteSnapshot.set({
      situacao: {
        codigo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
        rotulo: SituacaoDoProcessoSeletivoCodigo.PUBLICADO,
      },
    } as never);
    detectar();

    expect(elemento.querySelector('input, button')).toBeNull();
    const lida = (titulo: string): string[] =>
      Array.from(
        elemento.querySelector(`[aria-labelledby="${titulo}"]`)?.querySelectorAll('li') ?? [],
        (li) => li.textContent?.trim() ?? '',
      );
    expect(lida('atend-secao-condicoes')).toEqual(['Pessoa com deficiência']);
    // O processo publicou o tipo; o catálogo tê-lo removido depois não muda a leitura.
    expect(lida('atend-secao-tipos')).toEqual(['Tipo já removido']);
    expect(
      elemento.querySelector('[aria-labelledby="atend-secao-recursos"]')?.textContent?.trim(),
    ).toBe('Nenhum recurso de acessibilidade oferecido');
    expect(elemento.textContent).not.toContain('Removido do cadastro');
  });
});
