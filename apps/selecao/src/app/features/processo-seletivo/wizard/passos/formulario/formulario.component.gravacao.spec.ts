import { describe, expect, it } from 'vitest';

import { comInscricao, inscricaoGravada } from './formulario-de-inscricao.testing';
import { conteudoDaInscricao, formularioDoCodigo } from './formularios-do-rascunho';
import { GravacaoDosFormularios } from './servicos/gravacao-dos-formularios.service';
import {
  PROBLEM_JSON,
  PROCESSO,
  proximoPasso,
  ROTA_HABILITACAO,
  ROTA_INSCRICAO,
  ROTA_PROCESSO,
  usarPasso,
  type ContextoDoPasso,
} from './formulario-passo.testing';

const INSCRICOES = new Set(['INSCRICAO']);

describe('FormularioPassoComponent: gravação', () => {
  let fixture: ContextoDoPasso['fixture'];
  let store: ContextoDoPasso['store'];
  let controller: ContextoDoPasso['controller'];
  let contexto: ContextoDoPasso;

  usarPasso((montado) => {
    contexto = montado;
    ({ fixture, store, controller } = montado);
  });

  it('grava só o que mudou, seguindo o plano, e envia os itens sem os dados básicos', async () => {
    const conteudo = conteudoDaInscricao(store.draft().formulario, INSCRICOES);
    store.patchObjectSection(
      'formulario',
      comInscricao(store.draft().formulario, {
        ...conteudo,
        itens:
          conteudo.itens?.map((i) =>
            i.fatoCodigo === 'PCD' ? { ...i, rotulo: 'Você tem deficiência?' } : i,
          ) ?? [],
      }),
    );

    const gravacao = fixture.componentInstance.persistir();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);
    await proximoPasso();

    const itens = controller.expectOne(
      (r) => r.method === 'PUT' && r.url === `${ROTA_INSCRICAO}/itens`,
    );
    expect(
      itens.request.body.itens.map((i: { fatoCodigo: string; rotulo: string }) => [
        i.fatoCodigo,
        i.rotulo,
      ]),
    ).toEqual([['PCD', 'Você tem deficiência?']]);
    expect(itens.request.headers.has('Idempotency-Key')).toBe(true);
    itens.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    controller
      .expectOne(`${ROTA_PROCESSO}/referencia-temporal-fatos`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);

    expect(await gravacao).toEqual({ valid: true });
    // A releitura projeta o que o servidor tem, inclusive a fase pelo código.
    expect(formularioDoCodigo(store.draft().formulario, 'INSCRICAO')?.faseCodigo).toBe('INSCRICAO');
  });

  it('recusa o limite que não é número e diz em que formulário está', () => {
    const conteudo = conteudoDaInscricao(store.draft().formulario, INSCRICOES);
    store.patchObjectSection(
      'formulario',
      comInscricao(store.draft().formulario, {
        ...conteudo,
        itens:
          conteudo.itens?.map((i) =>
            i.fatoCodigo === 'PCD'
              ? {
                  ...i,
                  regras: {
                    ...i.regras,
                    restricoes: [{ tipo: 'TAMANHO_TEXTO', minimo: 'dez', maximo: null }],
                  },
                }
              : i,
          ) ?? [],
      }),
    );

    expect(fixture.componentInstance.validar()).toEqual({
      valid: false,
      messages: [
        'O formulário "Inscrição — Medicina 2027" tem campos que não são números: veja os campos marcados na aba dele.',
      ],
    });
  });

  it('a recusa de um item vai para ele, pelo índice da lista enviada sem os dados básicos', async () => {
    const conteudo = conteudoDaInscricao(store.draft().formulario, INSCRICOES);
    store.patchObjectSection(
      'formulario',
      comInscricao(store.draft().formulario, {
        ...conteudo,
        itens:
          conteudo.itens?.map((i) =>
            i.fatoCodigo === 'PCD'
              ? { ...i, apresentacao: { ...i.apresentacao, rotulo: 'Outro' } }
              : i,
          ) ?? [],
      }),
    );

    const gravacao = fixture.componentInstance.persistir();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);
    await proximoPasso();
    controller.expectOne(`${ROTA_INSCRICAO}/itens`).flush(
      {
        type: 'about:blank',
        title: 'Recusado.',
        status: 422,
        code: 'uniplus.selecao.formulario.item_invalido',
        traceId: '00000000000000000000000000000003',
        errors: [{ field: 'itens[0].rotulo', code: 'x', message: 'Rótulo recusado.' }],
      },
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
    );
    await proximoPasso();
    // Depois da recusa, relê para comparar a próxima tentativa com o que ficou gravado.
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(
      fixture.debugElement.injector
        .get(GravacaoDosFormularios)
        .recusas()
        .get('INSCRICAO')
        ?.porItem.get('PCD'),
    ).toEqual(['Rótulo recusado.']);
  });

  describe('formulário novo da fase', () => {
    const cronogramaFases = [
      ...PROCESSO.cronogramaFases,
      { id: 'F-HABILITACAO', codigo: 'HABILITACAO', coletaInscricao: false },
    ];
    const processoComOFormulario = {
      ...PROCESSO,
      cronogramaFases,
      formularios: [
        ...PROCESSO.formularios,
        { ...PROCESSO.formularios[0], codigo: 'HABILITACAO', faseId: 'F-HABILITACAO' },
      ],
    };
    const SEM_CONTEUDO = { status: 204, statusText: 'No Content' };
    const ITENS_RECUSADOS = {
      type: 'about:blank',
      title: 'Recusado.',
      status: 422,
      code: 'uniplus.selecao.formulario.item_invalido',
      traceId: '00000000000000000000000000000004',
      errors: [{ field: 'itens[0].rotulo', code: 'x', message: 'Rótulo recusado.' }],
    };
    const RECUSA = { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON };

    /** Põe no rascunho o formulário novo da habilitação, com itens, e começa a gravar. */
    function gravarOFormularioNovo() {
      contexto.comHabilitacao();
      const { formularios } = store.draft().formulario;
      const novo = { ...formularios[formularios.length - 1], conteudo: inscricaoGravada() };
      store.patchObjectSection('formulario', { formularios: [...formularios.slice(0, -1), novo] });
      const gravacao = fixture.componentInstance.persistir();
      controller.expectOne(ROTA_PROCESSO).flush({ ...PROCESSO, cronogramaFases });
      return { gravacao, novo };
    }

    it('fica gravado, com o conteúdo e as recusas, quando o servidor criou e recusou os itens', async () => {
      const { gravacao, novo } = gravarOFormularioNovo();
      await proximoPasso();
      controller.expectOne(ROTA_HABILITACAO).flush(null, SEM_CONTEUDO);
      await proximoPasso();
      controller.expectOne(`${ROTA_HABILITACAO}/itens`).flush(ITENS_RECUSADOS, RECUSA);
      await proximoPasso();
      controller.expectOne(ROTA_PROCESSO).flush(processoComOFormulario);

      expect((await gravacao).valid).toBe(false);
      const aba = formularioDoCodigo(store.draft().formulario, 'HABILITACAO');
      expect([aba?.gravado, aba?.conteudo]).toEqual([true, novo.conteudo]);
      expect(recusasDe('HABILITACAO')).toBe(true);
    });

    it('fica gravado mesmo quando a releitura do processo falha depois da recusa', async () => {
      const { gravacao, novo } = gravarOFormularioNovo();
      await proximoPasso();
      controller.expectOne(ROTA_HABILITACAO).flush(null, SEM_CONTEUDO);
      await proximoPasso();
      controller.expectOne(`${ROTA_HABILITACAO}/itens`).flush(ITENS_RECUSADOS, RECUSA);
      await proximoPasso();
      controller
        .expectOne(ROTA_PROCESSO)
        .flush(null, { status: 503, statusText: 'Service Unavailable' });

      expect((await gravacao).valid).toBe(false);
      const aba = formularioDoCodigo(store.draft().formulario, 'HABILITACAO');
      expect([aba?.gravado, aba?.conteudo]).toEqual([true, novo.conteudo]);
      expect(recusasDe('HABILITACAO')).toBe(true);
    });

    it('mantém gravados os formulários que gravaram antes da recusa quando a releitura falha', async () => {
      const { formularios } = store.draft().formulario;
      const [inscricao] = formularios;
      const alterada = {
        ...inscricao.conteudo,
        itens: (inscricao.conteudo.itens ?? []).map((i) =>
          i.fatoCodigo === 'PCD'
            ? { ...i, apresentacao: { ...i.apresentacao, rotulo: 'Outro' } }
            : i,
        ),
      };
      store.patchObjectSection('formulario', {
        formularios: [
          { ...inscricao, gravado: false, conteudo: alterada },
          ...formularios.slice(1),
        ],
      });
      const { gravacao } = gravarOFormularioNovo();
      await proximoPasso();
      controller.expectOne(`${ROTA_INSCRICAO}/itens`).flush(null, SEM_CONTEUDO);
      await proximoPasso();
      controller.expectOne(ROTA_HABILITACAO).flush(null, SEM_CONTEUDO);
      await proximoPasso();
      controller.expectOne(`${ROTA_HABILITACAO}/itens`).flush(ITENS_RECUSADOS, RECUSA);
      await proximoPasso();
      controller
        .expectOne(ROTA_PROCESSO)
        .flush(null, { status: 503, statusText: 'Service Unavailable' });

      expect((await gravacao).valid).toBe(false);
      const { formularios: depois } = store.draft().formulario;
      expect(depois.map((f) => [f.codigo, f.gravado])).toEqual([
        ['INSCRICAO', true],
        ['HABILITACAO', true],
      ]);
      expect(depois[0].conteudo).toEqual(alterada);
    });

    it('fica gravado quando a resposta ao cabeçalho se perde e a releitura mostra o formulário', async () => {
      const { gravacao } = gravarOFormularioNovo();
      await proximoPasso();
      controller
        .expectOne(ROTA_HABILITACAO)
        .flush(null, { status: 503, statusText: 'Service Unavailable' });
      await proximoPasso();
      controller.expectOne(ROTA_PROCESSO).flush(processoComOFormulario);

      expect((await gravacao).valid).toBe(false);
      expect(formularioDoCodigo(store.draft().formulario, 'HABILITACAO')?.gravado).toBe(true);
    });

    it('continua como rascunho, com o código livre, quando o próprio cabeçalho é recusado', async () => {
      const { gravacao } = gravarOFormularioNovo();
      await proximoPasso();
      controller.expectOne(ROTA_HABILITACAO).flush(ITENS_RECUSADOS, RECUSA);
      await proximoPasso();
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);

      expect((await gravacao).valid).toBe(false);
      expect(formularioDoCodigo(store.draft().formulario, 'HABILITACAO')?.gravado).toBe(false);
    });

    const recusasDe = (codigo: string): boolean =>
      fixture.debugElement.injector.get(GravacaoDosFormularios).recusas().has(codigo);
  });
});
