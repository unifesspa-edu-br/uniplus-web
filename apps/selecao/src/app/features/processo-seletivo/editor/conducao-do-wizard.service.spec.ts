import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PassoDoWizard } from '../wizard/passo-do-wizard';
import { ProcessoSeletivoStore } from '../wizard/processo-seletivo.store';
import { ReleituraDoSnapshot } from '../wizard/shared/releitura-do-snapshot.service';
import { ConducaoDoWizard } from './conducao-do-wizard.service';
import { FocoDoEditor } from './foco-do-editor.service';
import { RascunhoDaPublicacao } from './rascunho-da-publicacao.service';

const RESOLUCAO = 'Resolução nº 805/2024/Consepe';

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
        { provide: FocoDoEditor, useValue: {} },
        { provide: RascunhoDaPublicacao, useValue: {} },
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
});
