import { TestBed } from '@angular/core/testing';
import { FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import { type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';
import { conteudoInicial } from '@uniplus/shared-ui/components';
import { GravacaoDosCamposPressupostos } from '../../shared/campos-pressupostos.service';
import { CatalogoDeFatos } from './catalogos/catalogo-de-fatos.service';
import {
  BASE,
  PROCESSO_ID,
  ROTA_PROCESSO,
  ROTA_DOCUMENTOS,
  PROBLEM_JSON,
  ID_AVALIACAO,
  ID_RESULTADO,
  PROCESSO_COM_ETAPA_GRAVADA,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import { AjudantesDeExigencias } from './cronograma-exigencias.testing';

describe('CronogramaPassoComponent: conferência da norma', () => {
  let exigencias: ContextoDoCronograma['exigencias'];
  let conferencia: ContextoDoCronograma['conferencia'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let comFases: ContextoDoCronograma['comFases'];
  let comExigenciaDeclarada: AjudantesDeExigencias['comExigenciaDeclarada'];

  usarCronograma((tela) => {
    ({ exigencias, conferencia, store, controller, detectar, proximoPasso, comFases } = tela);
    ({ comExigenciaDeclarada } = new AjudantesDeExigencias(tela));
  });

  /**
   * A prontidão do passo espelha a recusa da publicação sobre a norma da exigência. A
   * conferência em si é função pura e tem teste próprio; aqui se prova que o componente de fato
   * ENXERGA as exigências declaradas, para a ligação entre o rascunho e ela não quebrar em
   * silêncio.
   */
  describe('conferência da norma das exigências', () => {
    it('acusa o gatilho que cita dado conhecido só depois da fase da exigência, com o que fazer', () => {
      TestBed.inject(CatalogoDeFatos).fatos.set([
        {
          codigo: 'MODALIDADE_CONVOCACAO',
          nome: 'Modalidade da convocação',
          dominio: 'CATEGORICO',
          origem: 'DERIVADO',
          cardinalidade: 'ESCALAR',
          binding: 'CLASSIFICACAO:MODALIDADE_CONVOCACAO',
          escopo: 'CANDIDATO',
          fonteValores: 'MODALIDADE',
          ativo: true,
          valoresDominio: null,
          pontoResolucao: 'RESULTADO_FINAL',
        } as unknown as FatoCandidatoView,
      ]);
      comExigenciaDeclarada(
        [
          {
            referencia: 'Lei 12.711/2012',
            abrangencia: 'FEDERAL',
            status: 'RESOLVIDO',
            observacao: '',
          },
        ],
        {
          aplicabilidade: 'CONDICIONAL',
          condicoes: [
            { clausula: 1, fato: 'MODALIDADE_CONVOCACAO', operador: 'IGUAL', valor: '"AC"' },
          ],
        },
      );
      comFases(ID_AVALIACAO, ID_RESULTADO);

      expect(conferencia.problemas()).toContainEqual(
        expect.stringContaining(
          '“Modalidade da convocação” só é conhecido na fase Resultado final, depois da fase em que o documento é exigido. Como resolver: exija o documento na fase Resultado final.',
        ),
      );
    });

    /**
     * A repetição pelo grupo do formulário é conferida antes do envio, como o gatilho: o grupo que
     * saiu do formulário depois de escolhido derrubaria a gravação da árvore inteira.
     */
    it('acusa a repetição por grupo que nenhum formulário tem, com o que fazer', () => {
      comExigenciaDeclarada([
        {
          referencia: 'Lei 12.711/2012',
          abrangencia: 'FEDERAL',
          status: 'RESOLVIDO',
          observacao: '',
        },
      ]);
      const documentos = store.draft().documentos;
      store.patchSection('documentos', {
        ...documentos,
        raizes: documentos.raizes.map((no) => ({ ...no, repetePorEntidade: 'FAMILIA' })),
      });
      detectar();

      expect(conferencia.problemas()).toContainEqual(
        expect.stringContaining(
          'Nenhum formulário do processo tem mais o grupo “FAMILIA”, pelo qual o documento se repete.',
        ),
      );
    });

    it('diz o que fazer quando o servidor recusa o gatilho pela fase', async () => {
      comExigenciaDeclarada([
        {
          referencia: 'Lei 12.711/2012',
          abrangencia: 'FEDERAL',
          status: 'RESOLVIDO',
          observacao: '',
        },
      ]);

      const gravacao = exigencias.gravar(PROCESSO_ID);
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
      await proximoPasso();
      controller.expectOne(ROTA_DOCUMENTOS).flush(
        {
          type: 'about:blank',
          title:
            'O fato citado na condição de gatilho só é conhecido numa fase posterior à fase em que o documento é exigido',
          status: 422,
          code: 'uniplus.selecao.documento_exigido.fato_resolvido_em_fase_posterior',
        },
        { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
      );

      expect((await gravacao).messages?.[0]).toContain(
        'Exija o documento numa fase em que o dado já seja conhecido, ou colete o dado num formulário respondido até a fase da exigência.',
      );
    });

    it('não põe na inscrição o fato que outra finalidade do rascunho, ainda não gravada, já coleta', async () => {
      TestBed.inject(CatalogoDeFatos).fatos.set([
        {
          codigo: 'RENDA_FAMILIAR',
          nome: 'Renda familiar',
          dominio: 'NUMERICO',
          origem: 'DECLARADO',
          cardinalidade: 'UNIVALORADO',
          binding: 'CAMPO_FORMULARIO:RENDA_FAMILIAR',
          escopo: 'CANDIDATO',
          fonteValores: null,
          ativo: true,
          valoresDominio: null,
        } as unknown as FatoCandidatoView,
      ]);
      comExigenciaDeclarada(
        [
          {
            referencia: 'Lei 12.711/2012',
            abrangencia: 'FEDERAL',
            status: 'RESOLVIDO',
            observacao: '',
          },
        ],
        {
          aplicabilidade: 'CONDICIONAL',
          condicoes: [
            { clausula: 0, ordem: 0, fato: 'RENDA_FAMILIAR', operador: 'MENOR_QUE', valor: '1500' },
          ],
        },
      );
      const habilitacao = {
        ...conteudoInicial(),
        itens: [{ fatoCodigo: 'RENDA_FAMILIAR', ordem: 0, etapaCodigo: null } as never],
      };
      store.patchObjectSection('formulario', {
        outrasFinalidades: [
          { finalidade: 'HABILITACAO', faseCodigo: 'HABILITACAO', conteudo: habilitacao },
        ],
      });

      const resultado = await TestBed.inject(GravacaoDosCamposPressupostos).garantirCampos(
        PROCESSO_ID,
        {
          formularios: [],
          cronogramaFases: [],
          regrasDerivacao: [],
        } as unknown as ProcessoSeletivoDto,
        new Set(['RENDA_FAMILIAR']),
      );

      expect(resultado, 'nada a acrescentar: nenhuma gravação').toEqual({ tipo: 'garantidos' });
    });

    /**
     * Processo novo: o formulário de inscrição ainda não existe, e os itens só se gravam nele. O
     * cronograma o cria pelo cabeçalho (a seção dos outros dados, a revisão e aceite e a fase que
     * coleta inscrição), relê para ter a seção dos dados básicos que a API acrescenta, e só então
     * manda os itens — sem os dados básicos. O campo que entrou sozinho fica registrado como tal:
     * é esse registro que autoriza tirá-lo quando o gatilho sair.
     */
    it('cria o formulário de inscrição que falta, relê e grava os campos que as exigências pressupõem', async () => {
      const catalogos = TestBed.inject(CatalogoDeFatos);
      catalogos.fatos.set([
        {
          codigo: 'RENDA_FAMILIAR',
          nome: 'Renda familiar',
          dominio: 'NUMERICO',
          origem: 'DECLARADO',
          cardinalidade: 'UNIVALORADO',
          binding: 'CAMPO_INSCRICAO:RENDA_FAMILIAR',
          escopo: 'CANDIDATO',
          fonteValores: null,
          ativo: true,
          valoresDominio: null,
        } as unknown as FatoCandidatoView,
      ]);

      comExigenciaDeclarada(
        [
          {
            referencia: 'Lei 12.711/2012',
            abrangencia: 'FEDERAL',
            status: 'RESOLVIDO',
            observacao: '',
          },
        ],
        {
          aplicabilidade: 'CONDICIONAL',
          condicoes: [
            { clausula: 0, ordem: 0, fato: 'RENDA_FAMILIAR', operador: 'MENOR_QUE', valor: '1500' },
          ],
        },
      );

      const FASE = { id: 'F-INSCRICAO', codigo: 'INSCRICAO', coletaInscricao: true };
      const etapa = (codigo: string, ordem: number, bloco: string | null = null) => ({
        codigo,
        ordem,
        tipo: bloco === null ? 'SECAO' : 'BLOCO',
        bloco,
        titulo: codigo,
        descricao: null,
        aviso: null,
        exibicao: null,
      });
      const criado = {
        finalidade: 'INSCRICAO',
        faseId: FASE.id,
        titulo: null,
        modeloOrigemId: null,
        modeloOrigemCodigo: null,
        etapas: [
          etapa('DADOS_BASICOS', 0),
          etapa('OUTROS_DADOS_EXIGIDOS', 1),
          etapa('REVISAO_E_ACEITE', 2, 'REVISAO_E_ACEITE'),
        ],
        fatosColetados: [
          {
            fatoCodigo: 'NOME',
            ordem: 0,
            rotulo: 'Nome',
            tipoRenderizacao: 'TEXTO',
            obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
            precondicao: null,
            opcoes: null,
            etapaCodigo: 'DADOS_BASICOS',
            formato: null,
            ajuda: null,
            pedirConfirmacao: false,
            restricoes: [],
            impedimento: null,
          },
        ],
        termos: [],
        grupos: [],
      };
      const ROTA_INSCRICAO = `${BASE}/api/selecao/admin/processos-seletivos/${PROCESSO_ID}/formularios/INSCRICAO`;

      const garantir = TestBed.inject(GravacaoDosCamposPressupostos).garantirCampos(
        PROCESSO_ID,
        {
          formularios: [],
          cronogramaFases: [FASE],
          regrasDerivacao: [],
        } as unknown as ProcessoSeletivoDto,
        new Set(['RENDA_FAMILIAR']),
      );

      const cabecalho = controller.expectOne((r) => r.method === 'PUT' && r.url === ROTA_INSCRICAO);
      expect(cabecalho.request.body).toMatchObject({ faseId: FASE.id });
      expect(cabecalho.request.body.etapas.map((e: { codigo: string }) => e.codigo)).toEqual([
        'OUTROS_DADOS_EXIGIDOS',
        'REVISAO_E_ACEITE',
      ]);
      cabecalho.flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();

      controller.expectOne(ROTA_PROCESSO).flush({ formularios: [criado], cronogramaFases: [FASE] });
      await proximoPasso();

      const itens = controller.expectOne(
        (r) => r.method === 'PUT' && r.url === `${ROTA_INSCRICAO}/itens`,
      );
      expect(
        itens.request.body.itens.map((i: { fatoCodigo: string; etapaCodigo: string }) => [
          i.fatoCodigo,
          i.etapaCodigo,
        ]),
      ).toEqual([['RENDA_FAMILIAR', 'OUTROS_DADOS_EXIGIDOS']]);
      expect(itens.request.body.grupos).toEqual([]);
      itens.flush(null, { status: 204, statusText: 'No Content' });
      await proximoPasso();

      const comCampo = {
        ...criado,
        fatosColetados: [
          ...criado.fatosColetados,
          {
            ...criado.fatosColetados[0],
            fatoCodigo: 'RENDA_FAMILIAR',
            ordem: 1,
            etapaCodigo: 'OUTROS_DADOS_EXIGIDOS',
          },
        ],
      };
      controller
        .expectOne(ROTA_PROCESSO)
        .flush({ formularios: [comCampo], cronogramaFases: [FASE] });
      await garantir;

      expect(store.draft().formulario.conteudo.itens?.map((c) => c.fatoCodigo)).toEqual([
        'NOME',
        'RENDA_FAMILIAR',
      ]);
      expect(store.draft().formulario.faseCodigo).toBe('INSCRICAO');
      expect(store.camposPostosPelasExigencias().has('RENDA_FAMILIAR')).toBe(true);
    });
  });
});
