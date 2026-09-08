import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiOk, apiResultInterceptor } from '@uniplus/shared-core/http';
import { RegraCatalogoDto, RegrasCatalogoApi, RegrasCatalogoQuery } from '@uniplus/shared-data/selecao';

import { CatalogosDeClassificacaoService } from './catalogos-de-classificacao.service';

function pagina(dados: readonly RegraCatalogoDto[]) {
  return of(apiOk(dados, 200, new HttpHeaders()));
}

function regra(codigo: string, tipo: string): RegraCatalogoDto {
  return {
    codigo,
    versao: '1.0',
    tipo,
    esquemaArgs: {},
    invariantes: {},
    baseLegal: `Base de ${codigo}`,
    hash: `hash-${codigo}`,
    modalidadesAdmitidas: null,
  };
}

const POR_TIPO: Record<string, readonly RegraCatalogoDto[]> = {
  regra_calculo: [regra('FORMULA-MEDIA-PONDERADA', 'regra_calculo')],
  regra_arredondamento: [regra('ARRED-TRUNCAR', 'regra_arredondamento')],
  regra_ordem_alocacao: [regra('ALOCACAO-OPCOES-RN04', 'regra_ordem_alocacao')],
  regra_eliminacao: [regra('ELIM-ZERO-EM-AREA', 'regra_eliminacao')],
  regra_bonus: [regra('BONUS-MULTIPLICATIVO', 'regra_bonus')],
  criterio_desempate: [regra('DESEMPATE-MAIOR-IDADE', 'criterio_desempate')],
};

function montar(listar = vi.fn((query: RegrasCatalogoQuery) => pagina(POR_TIPO[query.tipo ?? ''] ?? []))) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      CatalogosDeClassificacaoService,
      { provide: RegrasCatalogoApi, useValue: { listar } },
    ],
  });

  return { servico: TestBed.inject(CatalogosDeClassificacaoService), listar };
}

describe('CatalogosDeClassificacaoService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('carrega os seis tipos de regra por `tipo`, cada um na sua própria consulta', () => {
    const { servico, listar } = montar();
    servico.carregar();

    expect(servico.regrasCalculo().map((r) => r.codigo)).toEqual(['FORMULA-MEDIA-PONDERADA']);
    expect(servico.regrasArredondamento().map((r) => r.codigo)).toEqual(['ARRED-TRUNCAR']);
    expect(servico.regrasOrdemAlocacao().map((r) => r.codigo)).toEqual(['ALOCACAO-OPCOES-RN04']);
    expect(servico.regrasEliminacao().map((r) => r.codigo)).toEqual(['ELIM-ZERO-EM-AREA']);
    expect(servico.regrasBonus().map((r) => r.codigo)).toEqual(['BONUS-MULTIPLICATIVO']);
    expect(servico.criteriosDesempate().map((r) => r.codigo)).toEqual(['DESEMPATE-MAIOR-IDADE']);
    expect(servico.carregando()).toBe(false);

    const tiposPedidos = listar.mock.calls.map(([query]: [RegrasCatalogoQuery]) => query.tipo);
    expect(new Set(tiposPedidos)).toEqual(
      new Set([
        'regra_calculo',
        'regra_arredondamento',
        'regra_ordem_alocacao',
        'regra_eliminacao',
        'regra_bonus',
        'criterio_desempate',
      ]),
    );
  });

  it('não repete a busca quando dois passos pedem o carregamento', () => {
    const { servico, listar } = montar();
    servico.carregar();
    servico.carregar();

    expect(listar).toHaveBeenCalledTimes(6);
  });

  it('anuncia erro quando um dos seis catálogos falha, e libera nova tentativa', () => {
    const listar = vi.fn((query: RegrasCatalogoQuery) =>
      query.tipo === 'regra_bonus'
        ? throwError(() => new Error('falhou'))
        : pagina(POR_TIPO[query.tipo ?? ''] ?? []),
    );
    const { servico } = montar(listar);

    servico.carregar();

    expect(servico.erro()).toBeTruthy();
    expect(servico.carregando()).toBe(false);

    servico.carregar();
    expect(listar).toHaveBeenCalledTimes(12);
  });
});
