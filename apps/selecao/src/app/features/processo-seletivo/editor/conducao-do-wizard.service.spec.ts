import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import type { ReferenciaAoSuporte } from '@uniplus/shared-core/http';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PassoDoWizard } from '../wizard/passo-do-wizard';
import type { ValidacaoDoPasso } from '../wizard/processo-seletivo.models';
import { ProcessoSeletivoStore } from '../wizard/processo-seletivo.store';
import { ReleituraDoSnapshot } from '../wizard/shared/releitura-do-snapshot.service';
import { ConducaoDoWizard } from './conducao-do-wizard.service';
import { FocoDoEditor } from './foco-do-editor.service';

const RESOLUCAO = 'Resolução nº 805/2024/Consepe';
const REFERENCIA: ReferenciaAoSuporte = {
  origem: 'servidor',
  codigoDoErro: 'uniplus.selecao.exemplo',
  identificadorDoPedido: '0af7651916cd43dd8448eb211c80319c',
};

describe('ConducaoDoWizard', () => {
  let conducao: ConducaoDoWizard;
  let store: ProcessoSeletivoStore;

  const passoComum: PassoDoWizard = { validar: () => ({ valid: true }) };
  const gravarAposAClassificacao = vi.fn(async () => ({ valid: true }));
  const passoDoDesempate: PassoDoWizard = { ...passoComum, gravarAposAClassificacao };

  beforeEach(() => {
    gravarAposAClassificacao.mockClear();
    TestBed.configureTestingModule({
      providers: [
        ProcessoSeletivoStore,
        ConducaoDoWizard,
        { provide: ReleituraDoSnapshot, useValue: { reler: vi.fn(async () => true) } },
        { provide: FocoDoEditor, useValue: { revelarErro: vi.fn() } },
        { provide: PermissoesService, useValue: { tem: () => true } },
      ],
    });
    store = TestBed.inject(ProcessoSeletivoStore);
    conducao = TestBed.inject(ConducaoDoWizard);
    conducao.conectar(signal([passoComum, passoDoDesempate, passoComum]));
  });

  it('acha o passo que grava após a classificação sem conhecer o componente', () => {
    expect(conducao.indiceDoPassoPosClassificacao()).toBe(1);
  });

  it('não acha passo nenhum quando nenhum grava após a classificação', () => {
    conducao.conectar(signal([passoComum, passoComum]));

    expect(conducao.indiceDoPassoPosClassificacao()).toBe(-1);
  });

  it('grava os critérios adiados pelo passo achado quando a classificação já congelou o quadro', async () => {
    store.classificacao.desempatePendenteDeGravacao.set(true);
    store.classificacao.registrarLida({
      resolucaoPesoAreaEnem: RESOLUCAO,
      quadroPesoAreaEnem: [
        {
          grupoAreaEnem: { codigo: 'G', rotulo: 'Grupo' },
          baseLegal: 'Anexo I',
          areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 2, corte: null }],
        },
      ],
    } as unknown as ProcessoSeletivoDto['classificacao']);

    const recusa = await conducao.gravarDesempatePendente();

    expect(recusa).toBeNull();
    expect(gravarAposAClassificacao).toHaveBeenCalledOnce();
  });

  describe('referência ao suporte da recusa do passo', () => {
    const passoQueGrava = (resultado: ValidacaoDoPasso): PassoDoWizard => ({
      validar: () => ({ valid: true }),
      persistir: async () => resultado,
    });

    beforeEach(() => store.goTo(3));

    it('a recusa do servidor mostra a referência com o passo onde ela aconteceu', async () => {
      const recusa = { valid: false, messages: ['Recusada.'], referenciaAoSuporte: REFERENCIA };

      await conducao.gravarEAvancar(passoQueGrava(recusa));

      expect(store.erroDoPasso()).toEqual({
        mensagens: ['Recusada.'],
        referencias: [{ passo: 'Passo 4 — Vagas', referencia: REFERENCIA }],
      });
    });

    it('a recusa sem referência não mostra referência nenhuma', async () => {
      await conducao.gravarEAvancar(passoQueGrava({ valid: false, messages: ['Recusada.'] }));

      expect(store.erroDoPasso()).toEqual({ mensagens: ['Recusada.'], referencias: [] });
    });

    it('a falha ao concluir no próprio navegador não inventa referência', async () => {
      const passo = { ...passoComum, persistir: () => Promise.reject(new Error('falhou')) };

      await conducao.gravarEAvancar(passo);

      expect(store.erroDoPasso()?.referencias).toEqual([]);
    });

    it('a resposta descartada, sem mensagens, não mostra erro nem referência', async () => {
      const descartada = { valid: false, messages: [], referenciaAoSuporte: REFERENCIA };

      await conducao.gravarEAvancar(passoQueGrava(descartada));

      expect(store.erroDoPasso()).toBeNull();
    });

    it('a validação local do passo não mostra referência', async () => {
      const invalido = { validar: () => ({ valid: false, messages: ['Falta preencher.'] }) };
      conducao.conectar(signal([passoComum, passoComum, passoComum, invalido]));

      await conducao.avancar();

      expect(store.erroDoPasso()).toEqual({ mensagens: ['Falta preencher.'], referencias: [] });
    });

    it('a gravação que dá certo limpa a mensagem e a referência juntas', async () => {
      const recusa = { valid: false, messages: ['Recusada.'], referenciaAoSuporte: REFERENCIA };
      await conducao.gravarEAvancar(passoQueGrava(recusa));

      await conducao.gravarEAvancar(passoQueGrava({ valid: true }));

      expect(store.erroDoPasso()).toBeNull();
    });
  });
});
