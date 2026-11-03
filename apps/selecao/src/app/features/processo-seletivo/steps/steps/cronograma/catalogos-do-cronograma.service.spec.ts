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
  type TipoDocumentoDto,
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
  readonly tiposDocumento?: readonly TipoDocumentoDto[];
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
      { provide: TiposDocumentoApi, useValue: { listar: () => pagina(cenario.tiposDocumento ?? []) } },
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

describe('CatalogosDoCronogramaService — carregamento', () => {
  beforeEach(() => TestBed.resetTestingModule());

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

describe('CatalogosDoCronogramaService — tipos que aguardam a proteção de dados', () => {
  beforeEach(() => TestBed.resetTestingModule());

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

  it('marca o tipo pendente pela situação do próprio tipo, sem consultar permissão nem fila de aprovação', () => {
    // Nenhum PermissoesService nem ProtecaoDoCatalogoApi é provido: quem não mantém nem aprova o catálogo vê a mesma marca.
    const { servico } = montar({ tiposDocumento: [tipo('laudo', false), tipo('rg', true)] });

    expect([...servico.tiposAguardandoProtecao()]).toEqual(['laudo']);
  });
});
