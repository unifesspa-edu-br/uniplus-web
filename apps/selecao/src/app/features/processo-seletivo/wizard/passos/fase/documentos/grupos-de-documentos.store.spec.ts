import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { exigencia, rascunho } from '../../../shared/exigencias/exigencias.testing';
import { FaseEmEdicao } from '../fase-em-edicao';
import { GruposDeDocumentosStore } from './grupos-de-documentos.store';

function montarGrupos(): GruposDeDocumentosStore {
  const documentos = rascunho(
    exigencia({ tipoDocumentoId: 'RG' }),
    exigencia({ tipoDocumentoId: 'CIN' }),
    exigencia({ tipoDocumentoId: 'CNH' }),
  );
  const draft = signal({ documentos });
  const patchSection = vi.fn((_secao: string, atualizados: typeof documentos) =>
    draft.set({ documentos: atualizados }),
  );
  TestBed.configureTestingModule({
    providers: [
      GruposDeDocumentosStore,
      { provide: ProcessoSeletivoStore, useValue: { draft, patchSection } },
      { provide: FaseEmEdicao, useValue: { faseDoRascunho: signal({ codigo: 'HABILITACAO' }) } },
    ],
  });
  return TestBed.inject(GruposDeDocumentosStore);
}

describe('GruposDeDocumentosStore', () => {
  it('combina documentos da fase e permite alterar e retirar itens', () => {
    const grupos = montarGrupos();
    const identificadores = grupos.documentosSoltos().map((regra) => regra.identificadorNoRascunho);
    grupos.criar(identificadores);
    const identificador = grupos.grupos()[0].identificadorNoRascunho;
    grupos.trocarQuantidade(identificador, 2);
    grupos.retirar(identificador, identificadores[0]);
    expect(grupos.grupos()[0].quantidadeMinima).toBe(2);
    expect(grupos.grupos()[0].itens).toHaveLength(2);
    expect(grupos.documentosSoltos()).toHaveLength(1);
  });
});
