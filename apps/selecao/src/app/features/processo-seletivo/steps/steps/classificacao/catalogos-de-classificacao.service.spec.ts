import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiOk,
  apiResultInterceptor,
  errorResult,
  mockProblemDetails,
} from '@uniplus/shared-core/http';
import { PesosEnemApi } from '@uniplus/shared-data/configuracao';
import {
  RegraCatalogoDto,
  RegrasCatalogoApi,
  RegrasCatalogoQuery,
} from '@uniplus/shared-data/selecao';

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

const RESOLUCAO = 'Resolução nº 805/2024/Consepe';

function linhaDePeso(resolucao: string, grupo: string) {
  return {
    id: `${resolucao}-${grupo}`,
    resolucao,
    grupoCurso: { codigo: grupo, rotulo: grupo },
    areas: [],
    baseLegal: `${resolucao} – Anexo I`,
    criadoEm: '2026-09-01T00:00:00Z',
  };
}

const listarAreas = vi.fn(() =>
  of(apiOk([{ codigo: 'REDACAO', rotulo: 'Redação' }], 200, new HttpHeaders())),
);

function montar(
  listar = vi.fn((query: RegrasCatalogoQuery) => pagina(POR_TIPO[query.tipo ?? ''] ?? [])),
  listarPesos = vi.fn(() =>
    of(
      apiOk(
        [linhaDePeso(RESOLUCAO, 'TECNOLOGICA'), linhaDePeso(RESOLUCAO, 'SAUDE_E_BIOLOGICAS')],
        200,
        new HttpHeaders(),
      ),
    ),
  ),
) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      CatalogosDeClassificacaoService,
      { provide: RegrasCatalogoApi, useValue: { listar } },
      { provide: PesosEnemApi, useValue: { listar: listarPesos, listarAreas } },
    ],
  });

  return {
    servico: TestBed.inject(CatalogosDeClassificacaoService),
    listar,
    listarPesos,
    listarAreas,
  };
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

  describe('cadastro de Peso por Área', () => {
    it('não lê o cadastro até alguém precisar dele, e lê uma vez só', () => {
      const { servico, listarPesos } = montar();

      servico.carregar();
      expect(listarPesos).not.toHaveBeenCalled();

      servico.garantirPesosAreaEnem(0);
      servico.garantirPesosAreaEnem(0);
      expect(listarPesos).toHaveBeenCalledTimes(1);
      expect(servico.resolucoesPesoAreaEnem()).toEqual([RESOLUCAO]);
    });

    it('numera cada leitura quando ela é pedida, e não quando a resposta chega', () => {
      const { servico, listarPesos } = montar();
      servico.garantirPesosAreaEnem(0);
      listarPesos.mockReturnValueOnce(new Subject<never>());
      const substituta = new Subject<ReturnType<typeof apiOk>>();
      listarPesos.mockReturnValueOnce(substituta as never);

      servico.garantirPesosAreaEnem(1);
      servico.garantirPesosAreaEnem(2);
      substituta.next(apiOk([linhaDePeso(RESOLUCAO, 'TECNOLOGICA')], 200, new HttpHeaders()));
      substituta.complete();

      // A segunda leitura foi substituída pela terceira antes de responder.
      expect(servico.pesosLeituraPedida()).toBe(3);
      expect(servico.pesosLidosNaLeitura()).toBe(3);
    });

    it('lê de novo para uma marca nova e, até a leitura, mantém a anterior com a marca dela', () => {
      const { servico, listarPesos } = montar();

      servico.garantirPesosAreaEnem(0);
      listarPesos.mockReturnValueOnce(new Subject<never>());
      servico.garantirPesosAreaEnem(1);

      expect(listarPesos).toHaveBeenCalledTimes(2);
      expect(servico.pesosLidosNaMarca()).toBe(0);
      expect(servico.resolucoesPesoAreaEnem()).toEqual([RESOLUCAO]);
    });

    it('a resposta atrasada de uma marca anterior não substitui a leitura da marca atual', () => {
      const antiga = new Subject<ReturnType<typeof apiOk>>();
      const { servico, listarPesos } = montar();
      listarPesos.mockReturnValueOnce(antiga.asObservable() as never);

      servico.garantirPesosAreaEnem(0);
      servico.garantirPesosAreaEnem(1);
      antiga.next(apiOk([linhaDePeso('Resolução antiga', 'TECNOLOGICA')], 200, new HttpHeaders()));
      antiga.complete();

      expect(servico.resolucoesPesoAreaEnem()).toEqual([RESOLUCAO]);
      expect(servico.pesosLidosNaMarca()).toBe(1);
    });

    it('na troca de processo esquece lista, falhas, leitura válida e marca pedida', () => {
      const listarPesos = vi.fn(() => throwError(() => new Error('falha')));
      const { servico } = montar(undefined, listarPesos);
      servico.garantirPesosAreaEnem(0);
      expect(servico.pesosErro()).not.toBeNull();

      servico.esquecerPesosAreaEnem();

      expect(servico.pesosErro()).toBeNull();
      expect(servico.pesosAreaEnem()).toEqual([]);
      expect(servico.pesosLidosNaMarca()).toBe(-1);
      servico.garantirPesosAreaEnem(0);
      expect(listarPesos).toHaveBeenCalledTimes(2);
    });

    it('a releitura pedida por quem espera o resultado, substituída por uma marca nova, ainda o avisa', () => {
      const substituida = new Subject<ReturnType<typeof apiOk>>();
      const { servico, listarPesos } = montar();
      servico.garantirPesosAreaEnem(0);
      listarPesos.mockReturnValueOnce(substituida.asObservable() as never);
      const aoLer = vi.fn();

      servico.recarregarPesosAreaEnem(0, aoLer);
      servico.garantirPesosAreaEnem(1);

      expect(aoLer).toHaveBeenCalledTimes(1);
      expect(servico.pesosLidosNaMarca()).toBe(1);
    });

    it.each([
      ['no envelope', () => of(errorResult(mockProblemDetails({ status: 503 })))],
      ['fora do envelope', () => throwError(() => new Error('falha'))],
    ])(
      'a falha da lista canônica das áreas (%s) não derruba a leitura do cadastro, e é pedida de novo quando ela termina',
      (_, falha) => {
        listarAreas.mockClear();
        listarAreas.mockReturnValueOnce(falha() as never);
        const { servico } = montar();

        servico.garantirPesosAreaEnem(0);

        expect(servico.pesosErro()).toBeNull();
        expect(servico.pesosLidosNaMarca()).toBe(0);
        expect(servico.resolucoesPesoAreaEnem()).toEqual([RESOLUCAO]);
        expect(listarAreas).toHaveBeenCalledTimes(2);
        expect(servico.areasEnem()).toEqual([{ codigo: 'REDACAO', rotulo: 'Redação' }]);
      },
    );

    it('lê a lista canônica das áreas uma vez só, entre releituras do cadastro', () => {
      listarAreas.mockClear();
      const { servico } = montar();

      servico.garantirPesosAreaEnem(0);
      servico.recarregarPesosAreaEnem(0);
      servico.garantirAreasEnem();

      expect(listarAreas).toHaveBeenCalledTimes(1);
      expect(servico.areasEnem()).toEqual([{ codigo: 'REDACAO', rotulo: 'Redação' }]);
    });

    it('relê o cadastro a pedido, com o que mudou nele', () => {
      const listarPesos = vi
        .fn()
        .mockReturnValueOnce(
          of(apiOk([linhaDePeso(RESOLUCAO, 'TECNOLOGICA')], 200, new HttpHeaders())),
        )
        .mockReturnValueOnce(
          of(
            apiOk(
              [linhaDePeso(RESOLUCAO, 'TECNOLOGICA'), linhaDePeso('Resolução nova', 'TECNOLOGICA')],
              200,
              new HttpHeaders(),
            ),
          ),
        );
      const { servico } = montar(undefined, listarPesos);

      servico.garantirPesosAreaEnem(0);
      servico.recarregarPesosAreaEnem(0);

      expect([...servico.resolucoesPesoAreaEnem()].sort()).toEqual(
        ['Resolução nova', RESOLUCAO].sort(),
      );
    });

    it('a leitura que falha não fica marcada como lida', () => {
      const listarPesos = vi.fn(() => throwError(() => new Error('falha fora do envelope')));
      const { servico } = montar(undefined, listarPesos);

      servico.garantirPesosAreaEnem(0);

      expect(servico.pesosLidosNaMarca()).toBe(-1);
      expect(servico.pesosErro()).toContain(
        'Não foi possível carregar o cadastro de Peso por Área',
      );
    });

    it('muda o aviso a cada nova falha, para o leitor de tela anunciar de novo', () => {
      const listarPesos = vi.fn(() => throwError(() => new Error('falha')));
      const { servico } = montar(undefined, listarPesos);

      servico.garantirPesosAreaEnem(0);
      const primeira = servico.pesosErro();
      servico.recarregarPesosAreaEnem(0);
      const segunda = servico.pesosErro();

      expect(segunda).not.toBeNull();
      expect(segunda).not.toBe(primeira);
      expect(segunda).toContain('2ª tentativa');
    });
  });

  describe('lista canônica das áreas', () => {
    it('a lista de áreas que falhou enquanto a leitura do cadastro corria é pedida de novo quando ela termina', () => {
      const areasAvulsas = new Subject<never>();
      const pesos = new Subject<ReturnType<typeof apiOk<ReturnType<typeof linhaDePeso>[]>>>();
      const { servico } = montar(
        undefined,
        vi.fn(() => pesos),
      );
      listarAreas.mockClear();
      listarAreas.mockReturnValueOnce(areasAvulsas);

      servico.garantirAreasEnem();
      servico.garantirPesosAreaEnem(0);
      areasAvulsas.error(new Error('rede'));
      pesos.next(apiOk([], 200, new HttpHeaders()));
      pesos.complete();

      expect(listarAreas).toHaveBeenCalledTimes(2);
      expect(servico.areasEnem()).toEqual([{ codigo: 'REDACAO', rotulo: 'Redação' }]);
    });
  });
});
