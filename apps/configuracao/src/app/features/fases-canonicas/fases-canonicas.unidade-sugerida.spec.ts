import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import {
  BASE,
  CenaDaPagina,
  URL_DAS_UNIDADES,
  URL_DA_LISTA,
  faseAvaliacaoSeed,
  montarPagina,
  opcoesDaUnidade,
  propagar,
  responderLista,
  verificarRequisicoesDaPagina,
} from './fases-canonicas.testing';

describe('FasesCanonicasPage — unidade sugerida', () => {
  let cena: CenaDaPagina;

  beforeEach(() => {
    cena = montarPagina();
  });

  afterEach(() => verificarRequisicoesDaPagina(cena));

  const CGA = {
    id: '01960000-0000-7000-0000-0000000000a2',
    sigla: 'CGA',
    nome: 'Centro de Gestão Acadêmica',
  };
  const comSugestao = (origemId = CGA.id): FaseCanonicaDto => ({
    ...faseAvaliacaoSeed,
    unidadeSugerida: { origemId, sigla: 'CGA', nome: CGA.nome },
  });
  const urlPut = (fase: FaseCanonicaDto) =>
    `${BASE}/api/configuracao/admin/fases-canonicas/${fase.id}`;

  async function salvarComSucesso(fase: FaseCanonicaDto): Promise<unknown> {
    cena.edicao.salvar();
    const put = cena.controller.expectOne(urlPut(fase));
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagar(cena);
    await responderLista(cena, [fase], [CGA]);
    return put.request.body;
  }

  it('a lista mostra a sigla da unidade sugerida, ou "—" quando não há', async () => {
    await responderLista(
      cena,
      [comSugestao(), { ...faseAvaliacaoSeed, id: 'f2', codigo: 'MATRICULA' }],
      [CGA],
    );
    cena.fixture.detectChanges();

    const celulas = Array.from<HTMLElement>(
      cena.fixture.nativeElement.querySelectorAll('td[data-label="Unidade sugerida"]'),
    ).map((celula) => celula.textContent?.replace(/\s+/g, ' ').trim());
    expect(celulas).toEqual(['CGA, Centro de Gestão Acadêmica', '—Sem unidade sugerida']);
  });

  it('escolher a unidade no campo a leva ao comando de atualização', async () => {
    await responderLista(cena, [faseAvaliacaoSeed], [CGA]);
    cena.edicao.abrirEdicao(faseAvaliacaoSeed);
    cena.edicao.form.controls.unidadeSugeridaId.setValue(CGA.id);

    expect(await salvarComSucesso(faseAvaliacaoSeed)).toMatchObject({
      unidadeSugeridaId: CGA.id,
    });
  });

  it('limpar a unidade sugerida envia nulo, que retira a sugestão', async () => {
    const fase = comSugestao();
    await responderLista(cena, [fase], [CGA]);
    cena.edicao.abrirEdicao(fase);
    cena.edicao.form.controls.unidadeSugeridaId.setValue('');

    expect(await salvarComSucesso(fase)).toMatchObject({ unidadeSugeridaId: null });
  });

  it('a unidade gravada fora das ativas continua como opção, marcada "(removida do cadastro)"', async () => {
    const fase = comSugestao('01960000-0000-7000-0000-0000000000a9');
    await responderLista(cena, [fase], [CGA]);
    cena.edicao.abrirEdicao(fase);

    const [primeira] = cena.edicao.unidadesParaEscolha();
    expect(primeira).toMatchObject({
      rotulo: 'CGA — Centro de Gestão Acadêmica',
      removida: true,
    });
    expect(cena.edicao.form.controls.unidadeSugeridaId.value).toBe(fase.unidadeSugerida?.origemId);
    await propagar(cena);
    expect(opcoesDaUnidade(cena)).toContain(
      'CGA — Centro de Gestão Acadêmica (removida do cadastro)',
    );
  });

  it('não afirma que a unidade está removida quando o cadastro de unidades não carregou', async () => {
    const fase = comSugestao();
    const req = cena.controller.expectOne((r) => r.url === URL_DA_LISTA);
    req.flush([fase]);
    cena.controller
      .match((r) => r.url === URL_DAS_UNIDADES)
      .forEach((r) => r.flush(null, { status: 500, statusText: 'Server Error' }));
    await propagar(cena);
    cena.edicao.abrirEdicao(fase);

    expect(cena.edicao.unidadesParaEscolha()[0]?.removida).toBe(false);
    await propagar(cena);
    expect(opcoesDaUnidade(cena).join()).not.toContain('(removida do cadastro)');
  });

  it('a nova tentativa das unidades que dá certo leva o foco ao campo Unidade sugerida', async () => {
    const fase = comSugestao();
    cena.controller.expectOne((r) => r.url === URL_DA_LISTA).flush([fase]);
    cena.controller
      .match((r) => r.url === URL_DAS_UNIDADES)
      .forEach((r) => r.flush(null, { status: 500, statusText: 'Server Error' }));
    await propagar(cena);
    cena.edicao.abrirEdicao(fase);
    await propagar(cena);
    const tentar = (): HTMLButtonElement | null =>
      (cena.fixture.nativeElement as HTMLElement).querySelector('button.link-button');

    tentar()?.focus();
    tentar()?.click();
    await propagar(cena);

    cena.controller.expectOne((r) => r.url === URL_DAS_UNIDADES).flush([CGA]);
    await propagar(cena);
    await propagar(cena);

    expect(tentar()).toBeNull();
    expect(document.activeElement).toBe(
      (cena.fixture.nativeElement as HTMLElement).querySelector(
        'select[formControlName="unidadeSugeridaId"]',
      ),
    );
  });

  it('a recusa por unidade inexistente ou removida aparece no campo', async () => {
    await responderLista(cena, [faseAvaliacaoSeed], [CGA]);
    cena.edicao.abrirEdicao(faseAvaliacaoSeed);
    cena.edicao.form.controls.unidadeSugeridaId.setValue(CGA.id);

    cena.edicao.salvar();
    cena.controller.expectOne(urlPut(faseAvaliacaoSeed)).flush(
      {
        type: 'about:blank',
        title: 'Validação',
        status: 422,
        code: 'uniplus.validacao',
        traceId: '00000000000000000000000000000001',
        errors: [
          {
            field: 'unidadeSugeridaId',
            code: 'uniplus.configuracao.fase_canonica.unidade_sugerida_nao_encontrada',
            message: 'A unidade sugerida não está entre as unidades ativas.',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Content',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar(cena);
    cena.fixture.detectChanges();

    expect(mensagemDeErroDoControle(cena.edicao.form.controls.unidadeSugeridaId)).toBe(
      'A unidade sugerida não está entre as unidades ativas.',
    );
    expect(
      cena.fixture.nativeElement
        .querySelector('[formControlName="unidadeSugeridaId"]')
        ?.getAttribute('aria-invalid'),
    ).toBe('true');
  });
});
