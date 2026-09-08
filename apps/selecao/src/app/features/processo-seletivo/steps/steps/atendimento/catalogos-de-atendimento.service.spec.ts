import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiOk, apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CondicaoAtendimentoDto,
  CondicoesAtendimentoApi,
  RecursoAcessibilidadeApi,
  RecursoAcessibilidadeDto,
  TipoDeficienciaApi,
  TipoDeficienciaDto,
} from '@uniplus/shared-data/configuracao';

import { CatalogosDeAtendimentoService } from './catalogos-de-atendimento.service';

/** Página única: sem header `Link`, `coletarPaginas` para na primeira. */
function pagina<T>(dados: readonly T[]) {
  return of(apiOk(dados, 200, new HttpHeaders()));
}

function condicao(codigo: string, nome = codigo): CondicaoAtendimentoDto {
  return {
    id: `id-${codigo}`,
    codigo,
    nome,
    descricao: null,
    criadoEm: '2026-09-01T00:00:00Z',
  } as CondicaoAtendimentoDto;
}

function recurso(nome: string): RecursoAcessibilidadeDto {
  return {
    id: `id-${nome}`,
    nome,
    descricao: null,
    criadoEm: '2026-09-01T00:00:00Z',
  } as RecursoAcessibilidadeDto;
}

function tipoDeficiencia(codigo: string): TipoDeficienciaDto {
  return {
    id: `id-${codigo}`,
    codigo,
    nome: codigo,
    descricao: codigo,
    permanente: null,
    criadoEm: '2026-09-01T00:00:00Z',
  } as TipoDeficienciaDto;
}

interface Cenario {
  readonly condicoes?: readonly CondicaoAtendimentoDto[];
  readonly recursos?: readonly RecursoAcessibilidadeDto[];
  readonly tiposDeficiencia?: readonly TipoDeficienciaDto[];
}

function montar(cenario: Cenario = {}) {
  const listarCondicoes = vi.fn(() => pagina(cenario.condicoes ?? []));

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      CatalogosDeAtendimentoService,
      { provide: CondicoesAtendimentoApi, useValue: { listar: listarCondicoes } },
      { provide: RecursoAcessibilidadeApi, useValue: { listar: () => pagina(cenario.recursos ?? []) } },
      {
        provide: TipoDeficienciaApi,
        useValue: { listar: () => pagina(cenario.tiposDeficiencia ?? []) },
      },
    ],
  });

  const servico = TestBed.inject(CatalogosDeAtendimentoService);
  servico.carregar();
  return { servico, listarCondicoes };
}

describe('CatalogosDeAtendimentoService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('carrega os três catálogos', () => {
    const { servico } = montar({
      condicoes: [condicao('PCD', 'Pessoa com deficiência')],
      recursos: [recurso('Ledor')],
      tiposDeficiencia: [tipoDeficiencia('VISUAL')],
    });

    expect(servico.condicoes()).toHaveLength(1);
    expect(servico.recursos()).toHaveLength(1);
    expect(servico.tiposDeficiencia()).toHaveLength(1);
    expect(servico.carregando()).toBe(false);
  });

  /** O código canônico é `PCD`, não um id nem um rótulo — é a exceção nomeada do §4. */
  it('reconhece a condição PCD pelo código, sem depender da caixa', () => {
    const { servico } = montar({
      condicoes: [condicao('pcd', 'Pessoa com deficiência (smoke)'), condicao('OUTRA')],
    });

    expect(servico.condicaoPcd()?.nome).toBe('Pessoa com deficiência (smoke)');
  });

  it('condicaoPcd é undefined quando o cadastro não tem a condição canônica', () => {
    const { servico } = montar({ condicoes: [condicao('OUTRA')] });

    expect(servico.condicaoPcd()).toBeUndefined();
  });

  it('não repete a busca quando chamada mais de uma vez', () => {
    const { servico, listarCondicoes } = montar();

    servico.carregar();

    expect(listarCondicoes).toHaveBeenCalledTimes(1);
  });

  it('reporta erro e libera nova tentativa quando um catálogo falha', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        CatalogosDeAtendimentoService,
        { provide: CondicoesAtendimentoApi, useValue: { listar: () => pagina([]) } },
        {
          provide: RecursoAcessibilidadeApi,
          useValue: {
            listar: () =>
              of({
                ok: false as const,
                problem: { type: 'about:blank', title: 'falha', status: 500 },
              }),
          },
        },
        { provide: TipoDeficienciaApi, useValue: { listar: () => pagina([]) } },
      ],
    });

    const servico = TestBed.inject(CatalogosDeAtendimentoService);
    servico.carregar();

    expect(servico.erro()).not.toBeNull();
    expect(servico.carregando()).toBe(false);

    // Libera nova tentativa — a guarda de busca-em-andamento não pode travar
    // o botão "Tentar novamente" depois de uma falha.
    servico.carregar();
    expect(servico.erro()).not.toBeNull();
  });
});
