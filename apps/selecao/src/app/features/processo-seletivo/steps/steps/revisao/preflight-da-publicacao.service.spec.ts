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

  it('#742 — 422 de conformidade legal não avaliável é pendência, não falha: estrutural e tipos de ato carregam', async () => {
    // Sem isto, o certame sem fase de coleta acendia o alerta de erro, que na
    // tela esconde o bloco do ato — justamente onde o período que destravaria a
    // avaliação seria informado. O processo ficava impublicável.
    const obterConformidadeLegal = vi.fn(() =>
      of(
        apiFailure(
          {
            type: 'about:blank',
            title: 'Período de inscrição obrigatório',
            status: 422,
            detail:
              'O processo não tem fase do cronograma que colete inscrição, então o período de inscrição precisa ser informado na publicação.',
            code: 'uniplus.selecao.processo_seletivo.periodo_inscricao_obrigatorio_sem_fase_de_coleta',
            traceId: 't',
          },
          422,
          new HttpHeaders(),
        ),
      ),
    );
    const { servico } = montar({ obterConformidadeLegal });

    await servico.carregar(PROCESSO_ID, null);

    expect(servico.erro()).toBeNull();
    expect(servico.legalIndisponivel()).toContain('período de inscrição precisa ser informado');
    expect(servico.legal()).toBeNull();
    expect(servico.estrutural()).toEqual(ITENS);
    expect(servico.tiposAto()).toEqual(TIPOS_ATO);
    expect(servico.carregando()).toBe(false);
  });

  it('#742 — fase que coleta inscrição sem janela também é pendência, não falha', async () => {
    const obterConformidadeLegal = vi.fn(() =>
      of(
        apiFailure(
          {
            type: 'about:blank',
            title: 'Fase sem janela',
            status: 422,
            detail: "A fase 'INSCRICAO' coleta inscrição e precisa de início e fim definidos.",
            code: 'uniplus.selecao.processo_seletivo.fase_que_coleta_inscricao_sem_janela',
            traceId: 't',
          },
          422,
          new HttpHeaders(),
        ),
      ),
    );
    const { servico } = montar({ obterConformidadeLegal });

    await servico.carregar(PROCESSO_ID, null);

    expect(servico.erro()).toBeNull();
    expect(servico.legalIndisponivel()).toContain('início e fim definidos');
    expect(servico.estrutural()).toEqual(ITENS);
  });

  it('#742 — 422 de OUTRO código na conformidade legal continua sendo falha de carga', async () => {
    // O terceiro desfecho vale só para as pendências que o servidor nomeia como
    // "ainda não dá para avaliar". Qualquer outra recusa é falha, e a tela tem
    // de continuar oferecendo "Tentar novamente".
    const obterConformidadeLegal = vi.fn(() =>
      of(
        apiFailure(
          {
            type: 'about:blank',
            title: 'Outro',
            status: 422,
            code: 'uniplus.selecao.processo_seletivo.qualquer_outra_coisa',
            traceId: 't',
          },
          422,
          new HttpHeaders(),
        ),
      ),
    );
    const { servico } = montar({ obterConformidadeLegal });

    await servico.carregar(PROCESSO_ID, null);

    expect(servico.erro()).not.toBeNull();
    expect(servico.legalIndisponivel()).toBeNull();
    expect(servico.estrutural()).toBeNull();
    expect(servico.tiposAto()).toEqual([]);
  });

  it('#742 — a pendência é limpa quando uma carga seguinte avalia a conformidade legal', async () => {
    const obterConformidadeLegal = vi
      .fn()
      .mockReturnValueOnce(
        of(
          apiFailure(
            {
              type: 'about:blank',
              title: 'Período de inscrição obrigatório',
              status: 422,
              detail: 'Informe o período.',
              code: 'uniplus.selecao.processo_seletivo.periodo_inscricao_obrigatorio_sem_fase_de_coleta',
              traceId: 't',
            },
            422,
            new HttpHeaders(),
          ),
        ),
      )
      .mockReturnValueOnce(of(apiOk(LEGAL, 200, new HttpHeaders())));
    const { servico } = montar({ obterConformidadeLegal });

    await servico.carregar(PROCESSO_ID, null);
    expect(servico.legalIndisponivel()).not.toBeNull();

    await servico.recarregar(PROCESSO_ID, '2027-01-01');

    expect(servico.legalIndisponivel()).toBeNull();
    expect(servico.legal()).toEqual(LEGAL);
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
