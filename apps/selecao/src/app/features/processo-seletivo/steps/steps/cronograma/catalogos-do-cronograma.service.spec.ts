import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiOk, apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  FaseCanonicaDto,
  FasesCanonicasApi,
  PrecedenciaFaseDto,
  PrecedenciasFaseApi,
  TiposBancaApi,
  TiposEtapaApi,
} from '@uniplus/shared-data/configuracao';
import { TipoAtoPublicadoDto, TiposAtoApi } from '@uniplus/shared-data/publicacoes';
import { RegrasCatalogoApi } from '@uniplus/shared-data/selecao';

import { hojeNoFusoInstitucional } from '../../shared/fuso-institucional';
import { CatalogosDoCronogramaService } from './catalogos-do-cronograma.service';

/** Página única: sem header `Link`, `coletarPaginas` para na primeira. */
function pagina<T>(dados: readonly T[]) {
  return of(apiOk(dados, 200, new HttpHeaders()));
}

function fase(codigo: string): FaseCanonicaDto {
  return {
    id: `id-${codigo}`,
    codigo,
    nome: codigo,
    descricao: null,
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    baseLegal: null,
    produzResultado: false,
    resultadoDefinitivo: false,
    coletaInscricao: false,
    origemData: 'PROPRIA',
    criadoEm: '2026-08-30T12:00:00Z',
  } as FaseCanonicaDto;
}

function aresta(antecessora: string, sucessora: string): PrecedenciaFaseDto {
  return {
    id: `${antecessora}-${sucessora}`,
    antecessoraCodigo: antecessora,
    sucessoraCodigo: sucessora,
    permiteSobreposicao: false,
    criadoEm: '2026-08-30T12:00:00Z',
  } as PrecedenciaFaseDto;
}

function ato(codigo: string, vigenciaFim: string | null): TipoAtoPublicadoDto {
  return {
    id: `ato-${codigo}`,
    codigo,
    nome: `Ato ${codigo}`,
    congelaConfiguracao: false,
    unicoPorObjeto: false,
    efeitoIrreversivel: false,
    vigenciaInicio: '2020-01-01',
    vigenciaFim,
    baseLegal: null,
    criadoEm: '2026-08-30T12:00:00Z',
  } as TipoAtoPublicadoDto;
}

interface Cenario {
  readonly fases?: readonly FaseCanonicaDto[];
  readonly precedencias?: readonly PrecedenciaFaseDto[];
  readonly atos?: readonly TipoAtoPublicadoDto[];
}

function montar(cenario: Cenario = {}) {
  const listarAtos = vi.fn(() => pagina(cenario.atos ?? []));

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      CatalogosDoCronogramaService,
      {
        provide: FasesCanonicasApi,
        useValue: { listar: () => pagina(cenario.fases ?? []) },
      },
      {
        provide: PrecedenciasFaseApi,
        useValue: { listar: () => pagina(cenario.precedencias ?? []) },
      },
      { provide: TiposBancaApi, useValue: { listar: () => pagina([]) } },
      { provide: TiposEtapaApi, useValue: { listar: () => pagina([]) } },
      { provide: TiposAtoApi, useValue: { listar: listarAtos } },
      { provide: RegrasCatalogoApi, useValue: { listar: () => pagina([]) } },
    ],
  });

  const servico = TestBed.inject(CatalogosDoCronogramaService);
  servico.carregar();
  return { servico, listarAtos };
}

describe('CatalogosDoCronogramaService — ordem sugerida', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * O caso que um passe único de ajuste erra: com o catálogo em `B, C, A` e as
   * arestas nessa ordem, mover `B` para depois de `A` deixaria `C` antes de `B`,
   * violando `B→C`. A sugestão levaria o operador a uma ordem que o servidor
   * recusa.
   */
  it('respeita todas as arestas, qualquer que seja a ordem em que elas chegam', () => {
    const { servico } = montar({
      fases: [fase('B'), fase('C'), fase('A')],
      precedencias: [aresta('B', 'C'), aresta('A', 'B')],
    });

    const codigos = servico.fasesEmOrdemSugerida().map((f) => f.codigo);

    expect(codigos.indexOf('A')).toBeLessThan(codigos.indexOf('B'));
    expect(codigos.indexOf('B')).toBeLessThan(codigos.indexOf('C'));
  });

  it('mantém a ordem do catálogo entre fases que nenhuma aresta liga', () => {
    const { servico } = montar({ fases: [fase('X'), fase('Y'), fase('Z')] });

    expect(servico.fasesEmOrdemSugerida().map((f) => f.codigo)).toEqual(['X', 'Y', 'Z']);
  });

  /** Ciclo no cadastro não deveria existir, mas sumir com a fase é pior. */
  it('não perde fase quando o cadastro tem ciclo', () => {
    const { servico } = montar({
      fases: [fase('P'), fase('Q')],
      precedencias: [aresta('P', 'Q'), aresta('Q', 'P')],
    });

    expect(servico.fasesEmOrdemSugerida().map((f) => f.codigo).sort()).toEqual(['P', 'Q']);
  });
});

describe('CatalogosDoCronogramaService — tipos de ato', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * O servidor assume `vigentes: true`. Sem pedir a série completa, um ato já
   * referenciado por um cronograma gravado cuja versão encerrou não voltaria, e
   * a tela exibiria o vínculo sem rótulo.
   */
  it('pede a série histórica, não só os vigentes', () => {
    const { listarAtos } = montar();

    expect(listarAtos).toHaveBeenCalled();
    expect(listarAtos.mock.calls[0][0]).toMatchObject({ vigentes: false });
  });

  it('separa o que é escolhível hoje do que é apenas exibível', () => {
    const { servico } = montar({
      atos: [ato('VIGENTE', null), ato('ENCERRADO', '2021-01-01')],
    });

    expect(servico.atos()).toHaveLength(2);
    expect(servico.atosVigentes().map((a) => a.codigo)).toEqual(['VIGENTE']);
    expect(servico.rotuloDoAto().get('ENCERRADO')).toBe('Ato ENCERRADO');
  });

  /** A vigência é semiaberta: o dia do fim já está fora. */
  it('trata a vigência como semiaberta no extremo final', () => {
    const hoje = hojeNoFusoInstitucional();
    const { servico } = montar({ atos: [ato('FECHA_HOJE', hoje)] });

    expect(servico.atosVigentes()).toEqual([]);
  });
});
