import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import {
  MotivosDeDecisaoApi,
  OpcoesDoRecursoApi,
  RegrasCatalogoApi,
} from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';

import { CATALOGOS_DO_CRONOGRAMA } from './catalogos-do-cronograma';
import { falhaDoServidor, pagina } from './catalogos.testing';
import { SituacaoDosCatalogosDoCronograma } from './situacao-dos-catalogos-do-cronograma.service';

interface Falhas {
  readonly opcoesDoRecurso?: boolean;
  readonly emConsulta?: boolean;
  readonly fatos?: boolean;
  readonly unidades?: boolean;
  readonly motivos?: boolean;
}

interface Buscas {
  readonly fases: () => void;
  readonly unidades: () => void;
  readonly motivos: () => void;
  readonly opcoesDoRecurso?: () => void;
}

function montar(falhas: Falhas = {}, buscas?: Buscas) {
  const listarVazio = { listar: () => pagina([]) };
  const opcoes = () => {
    buscas?.opcoesDoRecurso?.();
    return falhas.opcoesDoRecurso ? falhaDoServidor() : pagina([]);
  };
  TestBed.configureTestingModule({
    providers: [
      ...CATALOGOS_DO_CRONOGRAMA,
      {
        provide: ProcessoSeletivoStore,
        useValue: { emConsulta: signal(falhas.emConsulta === true) },
      },
      {
        provide: OpcoesDoRecursoApi,
        useValue: {
          listarUnidadesDePrazo: opcoes,
          listarEfeitosSuspensivos: opcoes,
          listarGuardasDaVaga: opcoes,
        },
      },
      {
        provide: FasesCanonicasApi,
        useValue: {
          listar: () => {
            buscas?.fases();
            return pagina([]);
          },
        },
      },
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
        provide: MotivosDeDecisaoApi,
        useValue: {
          listar: () => {
            buscas?.motivos();
            return falhas.motivos ? falhaDoServidor() : pagina([]);
          },
        },
      },
      {
        provide: UnidadesApi,
        useValue: {
          listar: () => {
            buscas?.unidades();
            return falhas.unidades ? falhaDoServidor() : pagina([]);
          },
        },
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

  /** A falta dos motivos não derruba o editor: só a escolha dos motivos fica sem opções. */
  it('não conta a falha dos motivos de decisão como falha dos catálogos exigidos', () => {
    const situacao = montar({ motivos: true });

    expect(situacao.erro()).toBeNull();
    expect(situacao.leituraDosMotivos.visivel()).toBe(true);
  });

  /** Refazer só o que falhou abriria a tela com catálogos de rodadas diferentes. */
  it('repete a rodada inteira, inclusive os catálogos que já tinham carregado, as unidades e os motivos', () => {
    const buscas = { fases: vi.fn(), unidades: vi.fn(), motivos: vi.fn() };
    const situacao = montar({ fatos: true, unidades: true }, buscas);

    situacao.recarregar();

    expect(buscas.fases).toHaveBeenCalledTimes(2);
    expect(buscas.unidades).toHaveBeenCalledTimes(2);
    expect(buscas.motivos).toHaveBeenCalledTimes(2);
  });

  /** Em edição a tela oferece as opções do recurso, e sem elas ofereceria menos do que a API aceita. */
  it('conta a falha das opções do recurso como falha dos catálogos exigidos na edição', () => {
    const situacao = montar({ opcoesDoRecurso: true });

    expect(situacao.erro()).toContain('Não foi possível carregar os catálogos');
  });

  /** A consulta mostra o nome que a leitura devolveu: não precisa do vocabulário nem o busca. */
  it('na consulta, não busca as opções do recurso nem conta a falha delas', () => {
    const opcoesDoRecurso = vi.fn();
    const buscas = { fases: vi.fn(), unidades: vi.fn(), motivos: vi.fn(), opcoesDoRecurso };
    const situacao = montar({ opcoesDoRecurso: true, emConsulta: true }, buscas);

    situacao.recarregar();

    expect(opcoesDoRecurso).not.toHaveBeenCalled();
    expect(situacao.erro()).toBeNull();
  });

  it('na edição, repete a busca das opções do recurso junto com a rodada inteira', () => {
    const opcoesDoRecurso = vi.fn();
    const buscas = { fases: vi.fn(), unidades: vi.fn(), motivos: vi.fn(), opcoesDoRecurso };
    const situacao = montar({}, buscas);

    situacao.recarregar();

    expect(opcoesDoRecurso).toHaveBeenCalledTimes(6);
  });
});
