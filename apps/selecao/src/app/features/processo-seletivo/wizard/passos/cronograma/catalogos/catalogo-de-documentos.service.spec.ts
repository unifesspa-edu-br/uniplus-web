import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CategoriasDocumentoApi,
  TiposDocumentoApi,
  type TipoDocumentoDto,
} from '@uniplus/shared-data/configuracao';

import { CatalogoDeDocumentos } from './catalogo-de-documentos.service';
import { pagina } from './catalogos.testing';

const tipo = (id: string, protecaoAprovada: boolean): TipoDocumentoDto => ({
  id,
  codigo: id.toUpperCase(),
  nome: id,
  descricao: null,
  categoria: 'SAUDE',
  formatosAceitos: null,
  tamanhoMaximoMb: null,
  tipoEquivalente: null,
  classificacaoProtecao: 'SENSIVEL',
  finalidadeTratamento: 'Conferir o laudo do candidato.',
  hipoteseLegal: 'TUTELA_DA_SAUDE',
  protecaoAprovada,
  criadoEm: '2026-08-30T12:00:00Z',
});

describe('CatalogoDeDocumentos', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('marca o tipo pendente pela situação do próprio tipo, sem consultar permissão nem fila de aprovação', () => {
    // Nenhum PermissoesService nem ProtecaoDoCatalogoApi é provido: quem não mantém nem aprova o catálogo vê a mesma marca.
    TestBed.configureTestingModule({
      providers: [
        CatalogoDeDocumentos,
        { provide: CategoriasDocumentoApi, useValue: { listar: () => pagina([]) } },
        {
          provide: TiposDocumentoApi,
          useValue: { listar: () => pagina([tipo('laudo', false), tipo('rg', true)]) },
        },
      ],
    });
    const catalogo = TestBed.inject(CatalogoDeDocumentos);

    catalogo.carregar();

    expect([...catalogo.tiposAguardandoProtecao()]).toEqual(['laudo']);
  });
});
