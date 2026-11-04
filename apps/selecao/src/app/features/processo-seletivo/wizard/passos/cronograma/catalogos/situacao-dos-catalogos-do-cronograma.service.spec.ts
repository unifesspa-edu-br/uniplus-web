import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CategoriasDocumentoApi,
  FasesCanonicasApi,
  FatosCandidatoApi,
  PrecedenciasFaseApi,
  TiposBancaApi,
  TiposDocumentoApi,
  TiposEtapaApi,
} from '@uniplus/shared-data/configuracao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { TiposAtoApi } from '@uniplus/shared-data/publicacoes';
import { RegrasCatalogoApi } from '@uniplus/shared-data/selecao';

import { CATALOGOS_DO_CRONOGRAMA } from './catalogos-do-cronograma';
import { falhaDoServidor, pagina } from './catalogos.testing';
import { SituacaoDosCatalogosDoCronograma } from './situacao-dos-catalogos-do-cronograma.service';

interface Falhas {
  readonly fatos?: boolean;
  readonly unidades?: boolean;
}

function montar(falhas: Falhas = {}) {
  const listarVazio = { listar: () => pagina([]) };
  TestBed.configureTestingModule({
    providers: [
      ...CATALOGOS_DO_CRONOGRAMA,
      { provide: FasesCanonicasApi, useValue: listarVazio },
      { provide: PrecedenciasFaseApi, useValue: listarVazio },
      { provide: TiposBancaApi, useValue: listarVazio },
      { provide: CategoriasDocumentoApi, useValue: listarVazio },
      { provide: TiposEtapaApi, useValue: listarVazio },
      { provide: TiposDocumentoApi, useValue: listarVazio },
      { provide: TiposAtoApi, useValue: listarVazio },
      { provide: RegrasCatalogoApi, useValue: listarVazio },
      {
        provide: FatosCandidatoApi,
        useValue: { listar: () => (falhas.fatos ? falhaDoServidor() : of({ ok: true, data: [] })) },
      },
      {
        provide: UnidadesApi,
        useValue: { listar: () => (falhas.unidades ? falhaDoServidor() : pagina([])) },
      },
    ],
  });
  const situacao = TestBed.inject(SituacaoDosCatalogosDoCronograma);
  situacao.carregar();
  return situacao;
}

describe('SituacaoDosCatalogosDoCronograma', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('termina de carregar sem erro quando todos os catálogos respondem', () => {
    const situacao = montar();

    expect(situacao.carregando()).toBe(false);
    expect(situacao.erro()).toBeNull();
  });

  /** Um catálogo faltando deixaria a tela oferecendo menos do que existe: ou vêm todos, ou o erro. */
  it('anuncia uma única falha quando um dos catálogos exigidos não responde', () => {
    const situacao = montar({ fatos: true });

    expect(situacao.carregando()).toBe(false);
    expect(situacao.erro()).toContain('Não foi possível carregar os catálogos');
  });

  /** A falta das unidades não derruba o editor: só a escolha da unidade de cada fase fica sem opções. */
  it('não conta a falha das unidades como falha dos catálogos exigidos', () => {
    const situacao = montar({ unidades: true });

    expect(situacao.erro()).toBeNull();
  });
});
