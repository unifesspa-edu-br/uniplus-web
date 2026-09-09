import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure, apiOk } from '@uniplus/shared-core/http';
import {
  ConformidadeLegalProcessoSeletivoDto,
  ConformidadeProcessoSeletivoDto,
  ItemConformidadeDto,
  ProcessosSeletivosApi,
} from '@uniplus/shared-data/selecao';
import { TipoAtoPublicadoDto, TiposAtoApi } from '@uniplus/shared-data/publicacoes';

import { PreflightDaPublicacaoService } from './preflight-da-publicacao.service';

const PROCESSO_ID = '01960000-0000-7000-0000-000000000700';

const ITENS: ItemConformidadeDto[] = [
  { codigo: 'taxa_inscricao_nao_declarada', dimensao: 'taxa_inscricao', mensagem: 'x', ok: true },
];

/** `obterConformidade()` devolve o item por dentro do envelope `ConformidadeProcessoSeletivoDto`, não o array cru. */
const CONFORMIDADE: ConformidadeProcessoSeletivoDto = { processoSeletivoId: PROCESSO_ID, itens: ITENS };

const LEGAL: ConformidadeLegalProcessoSeletivoDto = {
  processoSeletivoId: PROCESSO_ID,
  dataReferencia: '2027-01-01',
  regras: [],
  avisos: [],
};

const TIPOS_ATO: TipoAtoPublicadoDto[] = [
  {
    id: 't1',
    codigo: 'PORTARIA',
    nome: 'Portaria',
    congelaConfiguracao: true,
    unicoPorObjeto: false,
    efeitoIrreversivel: true,
    ehResultado: false,
    vigenciaInicio: '2020-01-01',
    vigenciaFim: null,
    baseLegal: null,
    criadoEm: '2020-01-01T00:00:00Z',
  },
];

function montar(overrides?: {
  obterConformidade?: ReturnType<typeof vi.fn>;
  obterConformidadeLegal?: ReturnType<typeof vi.fn>;
  listarTiposAto?: ReturnType<typeof vi.fn>;
}) {
  const obterConformidade =
    overrides?.obterConformidade ?? vi.fn(() => of(apiOk(CONFORMIDADE, 200, new HttpHeaders())));
  const obterConformidadeLegal =
    overrides?.obterConformidadeLegal ?? vi.fn(() => of(apiOk(LEGAL, 200, new HttpHeaders())));
  const listarTiposAto =
    overrides?.listarTiposAto ?? vi.fn(() => of(apiOk(TIPOS_ATO, 200, new HttpHeaders())));

  TestBed.configureTestingModule({
    providers: [
      PreflightDaPublicacaoService,
      { provide: ProcessosSeletivosApi, useValue: { obterConformidade, obterConformidadeLegal } },
      { provide: TiposAtoApi, useValue: { listar: listarTiposAto } },
    ],
  });

  return {
    servico: TestBed.inject(PreflightDaPublicacaoService),
    obterConformidade,
    obterConformidadeLegal,
    listarTiposAto,
  };
}

describe('PreflightDaPublicacaoService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('carrega os três insumos e expõe cada um em seu próprio signal', async () => {
    const { servico } = montar();

    await servico.carregar(PROCESSO_ID, null);

    expect(servico.estrutural()).toEqual(ITENS);
    expect(servico.legal()).toEqual(LEGAL);
    expect(servico.tiposAto()).toEqual(TIPOS_ATO);
    expect(servico.carregando()).toBe(false);
    expect(servico.erro()).toBeNull();
  });

  it('omite dataReferencia quando não resolvida, e a envia quando conhecida', async () => {
    const { servico, obterConformidadeLegal } = montar();

    await servico.carregar(PROCESSO_ID, '2027-03-01');

    expect(obterConformidadeLegal).toHaveBeenCalledWith(PROCESSO_ID, '2027-03-01');
  });

  it('sem dataReferencia resolvida, deixa o servidor decidir a própria referência padrão', async () => {
    const { servico, obterConformidadeLegal } = montar();

    await servico.carregar(PROCESSO_ID, null);

    expect(obterConformidadeLegal).toHaveBeenCalledWith(PROCESSO_ID, undefined);
  });

  it('um dos três falhando falha os três — GET vazio não pode passar por checklist verde', async () => {
    const obterConformidade = vi.fn(() =>
      of(
        apiFailure(
          { type: 'about:blank', title: 'x', status: 500, code: 'erro', traceId: 't' },
          500,
          new HttpHeaders(),
        ),
      ),
    );
    const { servico } = montar({ obterConformidade });

    await servico.carregar(PROCESSO_ID, null);

    expect(servico.estrutural()).toBeNull();
    expect(servico.legal()).toBeNull();
    expect(servico.tiposAto()).toEqual([]);
    expect(servico.erro()).not.toBeNull();
    expect(servico.carregando()).toBe(false);
  });

  it('recarregar() repete a busca mesmo já tendo carregado — usado após 422 (CA-06)', async () => {
    const obterConformidade = vi
      .fn()
      .mockReturnValueOnce(of(apiOk(CONFORMIDADE, 200, new HttpHeaders())))
      .mockReturnValueOnce(
        of(
          apiOk(
            {
              processoSeletivoId: PROCESSO_ID,
              itens: [
                { codigo: 'x', dimensao: 'taxa_inscricao', mensagem: 'agora vermelho', ok: false },
              ],
            } satisfies ConformidadeProcessoSeletivoDto,
            200,
            new HttpHeaders(),
          ),
        ),
      );
    const { servico } = montar({ obterConformidade });

    await servico.carregar(PROCESSO_ID, null);
    expect(servico.estrutural()?.[0].ok).toBe(true);

    await servico.recarregar(PROCESSO_ID, null);
    expect(servico.estrutural()?.[0].ok).toBe(false);
    expect(obterConformidade).toHaveBeenCalledTimes(2);
  });

  it('carregar() de novo com o mesmo processo já carregado não repete a busca', async () => {
    const { servico, obterConformidade } = montar();

    await servico.carregar(PROCESSO_ID, null);
    await servico.carregar(PROCESSO_ID, null);

    expect(obterConformidade).toHaveBeenCalledTimes(1);
  });

  it('carregar() de novo depois de um erro anterior repete a busca', async () => {
    const obterConformidade = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('rede fora')))
      .mockReturnValueOnce(of(apiOk(CONFORMIDADE, 200, new HttpHeaders())));
    const { servico } = montar({ obterConformidade });

    await servico.carregar(PROCESSO_ID, null);
    expect(servico.erro()).not.toBeNull();

    await servico.carregar(PROCESSO_ID, null);
    expect(servico.erro()).toBeNull();
    expect(servico.estrutural()).toEqual(ITENS);
  });

  it('propaga erro de rede como a mesma mensagem genérica de indisponibilidade', async () => {
    const obterConformidade = vi.fn(() => throwError(() => new Error('rede fora')));
    const { servico } = montar({ obterConformidade });

    await servico.carregar(PROCESSO_ID, null);

    expect(servico.erro()).not.toBeNull();
    expect(servico.carregando()).toBe(false);
  });
});
