import { HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, Subject, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure, apiOk, apiResultInterceptor, type ApiResult } from '@uniplus/shared-core/http';
import {
  CategoriasDocumentoApi,
  FaseCanonicaDto,
  FasesCanonicasApi,
  PrecedenciaFaseDto,
  PrecedenciasFaseApi,
  TiposBancaApi,
  FatosCandidatoApi,
  TiposDocumentoApi,
  TiposEtapaApi,
} from '@uniplus/shared-data/configuracao';
import { UnidadesApi, type UnidadeDto } from '@uniplus/shared-data/organizacao';
import {
  TipoAtoPublicadoDto,
  TiposAtoApi,
  type TiposAtoQuery,
} from '@uniplus/shared-data/publicacoes';
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
    unidadeSugerida: null,
    agrupaEtapas: false,
    permiteComplementacao: false,
    baseLegal: null,
    coletaInscricao: false,
    origemData: 'NO_EDITAL',
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
    ehResultado: false,
    baseLegal: null,
    criadoEm: '2026-08-30T12:00:00Z',
  } as TipoAtoPublicadoDto;
}

interface Cenario {
  readonly fases?: readonly FaseCanonicaDto[];
  readonly precedencias?: readonly PrecedenciaFaseDto[];
  readonly atos?: readonly TipoAtoPublicadoDto[];
  readonly unidades?: readonly UnidadeDto[] | 'falha';
  readonly listarUnidades?: () => Observable<ApiResult<readonly UnidadeDto[]>>;
}

function montar(cenario: Cenario = {}) {
  const listarAtos = vi.fn((_query: TiposAtoQuery) => pagina(cenario.atos ?? []));

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
      {
        provide: UnidadesApi,
        useValue: {
          listar: () =>
            cenario.listarUnidades?.() ??
            (cenario.unidades === 'falha'
              ? of(apiFailure(
                  { type: 'about:blank', title: 'x', status: 500, code: 'uniplus.erro', traceId: '' },
                  500,
                  new HttpHeaders(),
                ))
              : pagina(cenario.unidades ?? [])),
        },
      },
      { provide: CategoriasDocumentoApi, useValue: { listar: () => pagina([]) } },
      { provide: TiposEtapaApi, useValue: { listar: () => pagina([]) } },
      { provide: TiposDocumentoApi, useValue: { listar: () => pagina([]) } },
  // O catálogo de fatos entra junto: é dele que sai o campo de formulário que uma exigência
  // condicionada pressupõe.
  { provide: FatosCandidatoApi, useValue: { listar: () => of({ ok: true, data: [] }) } },
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

  /**
   * A linha do tempo e a superfície de configuração por fase pedem os catálogos
   * ao nascer, e as duas nascem juntas. Sem a guarda, cada abertura do editor
   * dispararia a mesma rodada de requisições duas vezes.
   */
  it('não repete a busca quando dois passos pedem o carregamento', () => {
    const { servico, listarAtos } = montar();

    servico.carregar();

    expect(listarAtos).toHaveBeenCalledTimes(1);
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

describe('CatalogosDoCronogramaService — documentos do cadastro', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    montar();
  });

  function docsDe(tipo: Record<string, unknown>) {
    const servico = TestBed.inject(CatalogosDoCronogramaService);
    servico.tiposDocumento.set([
      { id: 'd1', codigo: 'D1', nome: 'Doc', categoria: 'X', ...tipo },
    ] as never);
    return servico.documentosPorCategoria()[0].docs[0];
  }

  /** Sem formato, o limite aparece sozinho; o texto não traz "Formatos aceitos: ." vazio. */
  it('monta o texto do cadastro só com as partes presentes', () => {
    expect(docsDe({ formatosAceitos: null, tamanhoMaximoMb: 10 }).formatos).toBe('Até 10 MB.');
    expect(docsDe({ formatosAceitos: 'pdf', tamanhoMaximoMb: null }).formatos).toBe(
      'Formatos aceitos: pdf.',
    );
    expect(docsDe({ formatosAceitos: ' ', tamanhoMaximoMb: null }).formatos).toBeNull();
  });

  /** O contrato admite o tamanho como texto: vazio ou não numérico não vira "Até  MB.". */
  it('ignora o tamanho que não é um número positivo', () => {
    expect(docsDe({ formatosAceitos: 'pdf', tamanhoMaximoMb: '' }).formatos).toBe(
      'Formatos aceitos: pdf.',
    );
    expect(docsDe({ formatosAceitos: 'pdf', tamanhoMaximoMb: 'abc' }).formatos).toBe(
      'Formatos aceitos: pdf.',
    );
    expect(docsDe({ formatosAceitos: null, tamanhoMaximoMb: '10' }).formatos).toBe('Até 10 MB.');
  });

  /** O limite é texto para o usuário: o decimal sai com vírgula. */
  it('escreve o tamanho fracionário com vírgula decimal', () => {
    expect(docsDe({ formatosAceitos: null, tamanhoMaximoMb: 2.5 }).formatos).toBe('Até 2,5 MB.');
  });

  /** Sem descrição, formato nem tamanho, não há o que orientar: nada a renderizar. */
  it('não tem orientação quando o cadastro não declara nada', () => {
    const doc = docsDe({ descricao: ' ', formatosAceitos: null, tamanhoMaximoMb: null });

    expect(doc.orientacao).toBeNull();
  });

  /** Descrição em branco não é descrição: a consulta lê "Sem descrição" e a edição cai nos formatos. */
  it('trata a descrição em branco como ausente', () => {
    const doc = docsDe({ descricao: '   ', formatosAceitos: 'pdf', tamanhoMaximoMb: null });

    expect(doc.descricao).toBeNull();
    expect(doc.orientacao).toBe('Formatos aceitos: pdf.');
  });
});

describe('CatalogosDoCronogramaService — unidades', () => {
  beforeEach(() => TestBed.resetTestingModule());

  const CGA = { id: 'unidade-cga', sigla: 'CGA', nome: 'Centro de Gestão Acadêmica' } as UnidadeDto;

  it('indexa as unidades do cadastro pelo id', () => {
    const { servico } = montar({ unidades: [CGA] });

    expect(servico.opcoesDeUnidade()).toEqual([
      { id: 'unidade-cga', rotulo: 'CGA — Centro de Gestão Acadêmica' },
    ]);
    expect(servico.erroDeUnidades()).toBeNull();
  });

  /** A falta das unidades não derruba o editor: só a escolha da unidade fica sem opções. */
  it('falha ao listar as unidades sem impedir os demais catálogos', () => {
    const { servico } = montar({ unidades: 'falha', fases: [fase('A')] });

    expect(servico.erroDeUnidades()).toBe('Não foi possível carregar as unidades. Tente novamente.');
    expect(servico.fases()).toHaveLength(1);
    expect(servico.erro()).toBeNull();
  });

  /** Uma resposta atrasada de carregamento anterior não pode desfazer a lista mais nova. */
  it('descarta a resposta do carregamento anterior quando outro já foi pedido', () => {
    const respostas: Subject<ApiResult<readonly UnidadeDto[]>>[] = [];
    const { servico } = montar({
      listarUnidades: () => {
        const resposta = new Subject<ApiResult<readonly UnidadeDto[]>>();
        respostas.push(resposta);
        return resposta;
      },
    });
    servico.carregarUnidades();

    respostas[1]?.next(apiOk([CGA], 200, new HttpHeaders()));
    respostas[1]?.complete();
    respostas[0]?.next(apiOk([], 200, new HttpHeaders()));

    expect(servico.unidades()).toEqual([CGA]);
  });
});
