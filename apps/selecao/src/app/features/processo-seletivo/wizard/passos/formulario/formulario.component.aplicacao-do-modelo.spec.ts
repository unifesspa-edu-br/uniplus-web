import { BlocoSistemaCodigo } from '@uniplus/shared-data/selecao';
import { conteudoInicial } from '@uniplus/shared-inscricao/formulario';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ExigenciaDeDocumento, FaseDoCronograma } from '../../processo-seletivo.models';
import {
  comExigenciaSemGrupo,
  exigenciaNova,
} from '../../shared/exigencias/exigencias-documentais';
import { formularioDoRascunho } from './formulario-de-inscricao.testing';
import { conteudoDaInscricao, formularioDoCodigo } from './formularios-do-rascunho';
import {
  CONGELADOS_DA_INSCRICAO,
  pagina,
  FASE_INSCRICAO,
  GRAVADO,
  HABILITACAO_GRAVADA,
  INSCRICAO_COPIADA,
  modelo,
  MODELOS,
  PROBLEM_JSON,
  PROCESSO,
  PROCESSO_COM_DERIVACOES,
  proximoPasso,
  relato,
  ROTA_APLICACAO,
  ROTA_HABILITACAO,
  ROTA_MODELOS,
  ROTA_PROCESSO,
  usarPasso,
  type ContextoDoPasso,
} from './formulario-passo.testing';

const INSCRICOES = new Set(['INSCRICAO']);

describe('FormularioPassoComponent: aplicação do modelo', () => {
  let fixture: ContextoDoPasso['fixture'];
  let store: ContextoDoPasso['store'];
  let controller: ContextoDoPasso['controller'];
  let host: ContextoDoPasso['host'];
  let servicoDeModelos: ContextoDoPasso['servicoDeModelos'];
  let comModelosCarregados: ContextoDoPasso['comModelosCarregados'];
  let comHabilitacao: ContextoDoPasso['comHabilitacao'];
  let escolherEAplicar: ContextoDoPasso['escolherEAplicar'];

  usarPasso((contexto) => {
    ({
      fixture,
      store,
      controller,
      host,
      servicoDeModelos,
      comModelosCarregados,
      comHabilitacao,
      escolherEAplicar,
    } = contexto);
  });

  const pedirModelo = (codigo: string) =>
    servicoDeModelos().pedir(
      formularioDoRascunho(conteudoInicial(), { codigo, gravado: true }),
      codigo === 'INSCRICAO',
    );

  describe('partindo de um modelo', () => {
    beforeEach(() => comModelosCarregados());

    const opcoesDoModelo = (posicao: number): string[] =>
      Array.from(
        host.querySelectorAll<HTMLOptionElement>(`#form-${posicao}-modelo option`),
        (opcao) => opcao.value,
      );

    it('pede ao cadastro só os modelos ativos do tipo do processo', () => {
      // O beforeEach já respondeu; a requisição é refeita para conferir os filtros que ela leva.
      servicoDeModelos().carregarModelos();
      const listagem = controller.expectOne((r) => r.url === ROTA_MODELOS);

      expect(listagem.request.params.get('tipoProcesso')).toBe('REGULAR_UNIFICADO');
      expect(listagem.request.params.get('ativo')).toBe('true');
      listagem.flush(MODELOS);
    });

    it('cada aba oferece só os modelos que servem à fase dela', () => {
      comHabilitacao();

      expect(opcoesDoModelo(0)).toEqual(['', 'insc']);
      expect(opcoesDoModelo(1)).toEqual(['', 'hab']);
    });

    it('liga a lista de modelos à ajuda que explica a substituição', () => {
      expect(host.querySelector('#form-0-modelo')?.getAttribute('aria-describedby')).toBe(
        'form-0-modelo-ajuda',
      );
    });

    it('antes de o processo existir, aplicar fica indisponível e a ajuda diz por quê', () => {
      servicoDeModelos().escolher('INSCRICAO', 'insc');
      store.processoSeletivoId.set(null);
      fixture.detectChanges();

      expect((host.querySelector('#form-0-aplicar-modelo') as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(host.querySelector('#form-0-modelo-ajuda')?.textContent).toContain(
        'depois que o processo for criado',
      );
    });

    it('pede confirmação antes de substituir, dizendo que as edições não gravadas saem', () => {
      servicoDeModelos().escolher('INSCRICAO', 'insc');
      fixture.detectChanges();
      (host.querySelector('#form-0-aplicar-modelo') as HTMLButtonElement).click();
      fixture.detectChanges();

      // Nenhuma requisição saiu: o afterEach confere.
      expect(servicoDeModelos().pendente()?.modelo.id).toBe('insc');
      expect(servicoDeModelos().aviso()).toContain(
        'inclusive as edições desta aba ainda não gravadas',
      );
      servicoDeModelos().cancelar();
      expect(servicoDeModelos().pendente()).toBeNull();
    });

    it('relê o processo e devolve ao formulário o que as exigências pressupõem, trava o passo enquanto aplica e mostra o resumo e a origem', async () => {
      const exigencia = {
        ...exigenciaNova('01960000-0000-7000-0000-0000000000d1', 'INSCRICAO'),
        aplicabilidade: 'CONDICIONAL',
        condicoes: [{ clausula: 0, fato: 'PCD', operador: 'IGUAL', valor: 'true' }],
      } as ExigenciaDeDocumento;
      store.patchSection(
        'documentos',
        comExigenciaSemGrupo({ regrasDeComprovacao: [], emTodasAsFases: [] }, exigencia),
      );

      const aplicacao = escolherEAplicar('INSCRICAO', 'insc');
      expect(
        store.operacaoEmAndamento(),
        'um PUT da aba durante a aplicação gravaria por cima da cópia',
      ).toBe(true);
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      const post = controller.expectOne((r) => r.method === 'POST' && r.url === ROTA_APLICACAO);
      expect(post.request.body).toEqual({ modeloId: 'insc', formularioCodigo: 'INSCRICAO' });
      expect(post.request.headers.get('Accept')).toBe(
        'application/vnd.uniplus.aplicacao-de-modelo-formulario.v1+json',
      );
      expect(post.request.headers.has('Idempotency-Key')).toBe(true);
      post.flush(relato('INSCRICAO'));
      await proximoPasso();
      controller
        .expectOne(ROTA_PROCESSO)
        .flush({ ...PROCESSO_COM_DERIVACOES, formularios: [INSCRICAO_COPIADA] });
      await aplicacao;
      fixture.detectChanges();

      expect(store.operacaoEmAndamento()).toBe(false);
      expect(
        conteudoDaInscricao(store.draft().formulario, INSCRICOES).itens?.map((i) => i.fatoCodigo),
      ).toEqual(['NOME', 'PCD']);
      expect(host.querySelector('#form-0-resumo-modelo')?.textContent).toContain(
        'Acrescentados porque o processo os pressupõe',
      );
      expect(host.querySelector('#form-0-resumo-modelo')?.textContent).toContain(
        'Pessoa com deficiência',
      );
      expect(host.querySelector('#form-0-origem')?.textContent).toContain('INSC');
    });

    it('o formulário que nasce da cópia recebe em seguida o cabeçalho com a fase da aba', async () => {
      const FASE_HABILITACAO: FaseDoCronograma = {
        ...FASE_INSCRICAO,
        faseCanonicaId: 'fc-habilitacao',
        codigo: 'HABILITACAO',
        ordem: 1,
        congelados: { ...CONGELADOS_DA_INSCRICAO, coletaInscricao: false },
      };
      store.patchSection('cronograma', {
        ...store.draft().cronograma,
        fases: [FASE_INSCRICAO, FASE_HABILITACAO],
      });
      store.patchObjectSection('formulario', {
        formularios: [
          ...store.draft().formulario.formularios,
          formularioDoRascunho(conteudoInicial(), {
            codigo: 'HABILITACAO',
            faseCodigo: 'HABILITACAO',
            gravado: true,
          }),
        ],
      });
      const fases = [
        ...PROCESSO.cronogramaFases,
        { id: 'F-HABILITACAO', codigo: 'HABILITACAO', coletaInscricao: false },
      ];
      const copiada = {
        ...HABILITACAO_GRAVADA,
        faseId: null,
        modeloOrigem: { id: 'hab', codigo: 'HAB' },
        paginas: [pagina('REVISAO_E_ACEITE', 0, BlocoSistemaCodigo.REVISAO_E_ACEITE)],
        coleta: { itens: [], grupos: [] },
      };

      const semContent = { status: 204, statusText: 'No Content' };
      const cabecalhoDaHabilitacao = () =>
        controller.expectOne((r) => r.method === 'PUT' && r.url === ROTA_HABILITACAO);

      const aplicacao = escolherEAplicar('HABILITACAO', 'hab');
      controller
        .expectOne(ROTA_PROCESSO)
        .flush({ ...PROCESSO_COM_DERIVACOES, cronogramaFases: fases });
      await proximoPasso();
      const antes = cabecalhoDaHabilitacao();
      expect(antes.request.body.faseId, 'o cabeçalho vai antes da cópia').toBe('F-HABILITACAO');
      antes.flush(null, semContent);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(relato('HABILITACAO'));
      await proximoPasso();
      controller.expectOne(ROTA_PROCESSO).flush({
        ...PROCESSO_COM_DERIVACOES,
        cronogramaFases: fases,
        formularios: [GRAVADO, copiada],
      });
      await proximoPasso();
      const depois = cabecalhoDaHabilitacao();
      expect(depois.request.body.faseId, 'a cópia desfez a fase, e ela é declarada de novo').toBe(
        'F-HABILITACAO',
      );
      depois.flush(null, semContent);
      await proximoPasso();
      controller.expectOne(ROTA_PROCESSO).flush({
        ...PROCESSO_COM_DERIVACOES,
        cronogramaFases: fases,
        formularios: [GRAVADO, { ...copiada, faseId: 'F-HABILITACAO', obrigatorio: false }],
      });
      await aplicacao;

      const habilitacao = formularioDoCodigo(store.draft().formulario, 'HABILITACAO');
      expect(habilitacao?.faseCodigo).toBe('HABILITACAO');
      expect(habilitacao?.obrigatorio, 'o rascunho recebe o cabeçalho depois de regravado').toBe(
        false,
      );
      expect(habilitacao?.modeloOrigemCodigo).toBe('HAB');
    });

    it('a recusa da aplicação aparece em texto na aba, que continua como estava', async () => {
      const antes = store.draft().formulario;

      const aplicacao = escolherEAplicar('INSCRICAO', 'insc');
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(
        {
          type: 'about:blank',
          title: 'O modelo não serve a este processo.',
          status: 422,
          code: 'uniplus.selecao.validacao',
          traceId: '00000000000000000000000000000005',
          errors: [
            {
              field: 'modelo.pressupostos[0]',
              code: 'AplicacaoDeModelo.PressupostoAusente',
              message: "O modelo cita 'RENDA', que a inscrição do processo não coleta.",
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
      );
      await aplicacao;
      fixture.detectChanges();

      expect(host.querySelector('#form-0-recusa-modelo')?.textContent).toContain(
        "O modelo cita 'RENDA', que a inscrição do processo não coleta.",
      );
      expect(store.draft().formulario).toBe(antes);
      expect(
        store.aplicacoesDeModeloEmAberto().size,
        'a recusa é definitiva: nada foi copiado',
      ).toBe(0);
    });

    it('a recusa da cópia depois de o cabeçalho gravar um formulário novo o deixa como gravado', async () => {
      store.patchObjectSection('formulario', {
        formularios: [
          ...store.draft().formulario.formularios,
          formularioDoRascunho(conteudoInicial(), { codigo: 'NOVO', gravado: false }),
        ],
      });
      const aplicacao = escolherEAplicar('NOVO', 'insc');
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller
        .expectOne((r) => r.method === 'PUT' && r.url.endsWith('/formularios/NOVO'))
        .flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();
      controller
        .expectOne(ROTA_APLICACAO)
        .flush(
          { type: 'about:blank', title: 'O modelo não serve a este processo.', status: 422 },
          { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
        );
      await aplicacao;

      expect(formularioDoCodigo(store.draft().formulario, 'NOVO')?.gravado).toBe(true);
    });

    it('a troca de processo descarta a aplicação que aguardava confirmação', () => {
      servicoDeModelos().escolher('INSCRICAO', 'insc');
      pedirModelo('INSCRICAO');

      store.reset();
      fixture.detectChanges();

      expect(servicoDeModelos().pendente()).toBeNull();
    });

    it('a lista de um tipo já trocado não chega por cima da do tipo atual', () => {
      servicoDeModelos().carregarModelos();
      const doTipoAnterior = controller.expectOne((r) => r.url === ROTA_MODELOS);

      store.patchObjectSection('tipoProcesso', { codigo: 'INDIGENA_E_QUILOMBOLA' });
      fixture.detectChanges();
      controller
        .expectOne(
          (r) => r.url === ROTA_MODELOS && r.params.get('tipoProcesso') === 'INDIGENA_E_QUILOMBOLA',
        )
        .flush([modelo('psiq', 'Inscrição do PSIQ', 'INSCRICAO')]);
      doTipoAnterior.flush(MODELOS);

      expect(
        servicoDeModelos()
          .modelos()
          .map((m) => m.id),
      ).toEqual(['psiq']);
    });

    it('a lista do primeiro pedido, chegando depois do segundo do mesmo tipo, não sobrepõe a nova', () => {
      servicoDeModelos().carregarModelos();
      servicoDeModelos().carregarModelos();
      const [primeiro, segundo] = controller.match((r) => r.url === ROTA_MODELOS);

      segundo.flush([modelo('novo', 'Inscrição nova', 'INSCRICAO')]);
      primeiro.flush(MODELOS);

      expect(
        servicoDeModelos()
          .modelos()
          .map((m) => m.id),
      ).toEqual(['novo']);
      expect(servicoDeModelos().modelosCarregando()).toBe(false);
    });

    it('o tipo esvaziado com a lista em curso não deixa a espera presa', () => {
      servicoDeModelos().carregarModelos();
      const doTipoAnterior = controller.expectOne((r) => r.url === ROTA_MODELOS);
      expect(servicoDeModelos().modelosCarregando()).toBe(true);

      store.patchObjectSection('tipoProcesso', { codigo: '' });
      fixture.detectChanges();
      doTipoAnterior.flush(MODELOS);

      expect(servicoDeModelos().modelosCarregando()).toBe(false);
    });
  });
});
