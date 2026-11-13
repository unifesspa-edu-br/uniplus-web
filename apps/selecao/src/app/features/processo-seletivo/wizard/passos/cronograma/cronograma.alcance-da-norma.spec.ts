import { describe, expect, it } from 'vitest';
import { ID_INSCRICAO, ID_AVALIACAO, FASES_CANONICAS } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import { AjudantesDeExigencias } from './cronograma-exigencias.testing';

describe('CronogramaPassoComponent: alcance da norma', () => {
  let expansao: ContextoDoCronograma['expansao'];
  let conferencia: ContextoDoCronograma['conferencia'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let detectar: ContextoDoCronograma['detectar'];
  let comFases: ContextoDoCronograma['comFases'];
  let comExigenciaDeclarada: AjudantesDeExigencias['comExigenciaDeclarada'];

  usarCronograma((tela) => {
    ({ expansao, conferencia, cronograma, store, detectar, comFases } = tela);
    ({ comExigenciaDeclarada } = new AjudantesDeExigencias(tela));
  });

  describe('conferência da norma das exigências', () => {
    /**
     * A fase com documento exigido e sem etapa nenhuma era removida sem confirmação: a
     * contagem varria os valores do rascunho como se fossem os registros planos do modelo
     * anterior e dava sempre zero, então as exigências sumiam junto com a fase sem que
     * ninguém fosse avisado.
     */
    it('conta os documentos da fase antes de removê-la', () => {
      comExigenciaDeclarada([
        {
          referencia: 'Lei 12.711/2012',
          abrangencia: 'FEDERAL',
          status: 'RESOLVIDO',
          observacao: '',
        },
      ]);

      const indice = cronograma.fases.controls.findIndex(
        (grupo) =>
          grupo.controls.codigo.value ===
          FASES_CANONICAS.find((f) => f.id === ID_AVALIACAO)?.codigo,
      );
      expect(indice).toBeGreaterThanOrEqual(0);

      expect(cronograma.dependentesDaFase(indice).documentos).toBe(1);

      expansao.pedirRemocaoDaFase(indice);
      expect(
        expansao.remocaoAConfirmar(),
        'a remoção precisa passar pela confirmação, porque leva o documento junto',
      ).toBe(indice);
      expect(expansao.resumoDaRemocao(indice)).toContain('1 documento exigido');
    });

    it('acusa a exigência que decide o resultado e está sem norma resolvida', () => {
      comExigenciaDeclarada([
        { referencia: '', abrangencia: 'INTERNA_EDITAL', status: 'RESOLVIDO', observacao: '' },
      ]);

      const resultado = conferencia.validar();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('norma');
    });

    it('não acusa quando alguma das normas declaradas está resolvida', () => {
      comExigenciaDeclarada([
        { referencia: '', abrangencia: 'INTERNA_EDITAL', status: 'RESOLVIDO', observacao: '' },
        {
          referencia: 'Lei 12.711/2012',
          abrangencia: 'FEDERAL',
          status: 'RESOLVIDO',
          observacao: '',
        },
      ]);

      expect(conferencia.validar().messages?.join(' ') ?? '').not.toContain('norma');
    });

    describe('alcance da exigência sobre as modalidades ofertadas', () => {
      const NORMA_RESOLVIDA = [
        {
          referencia: 'Lei 12.711/2012',
          abrangencia: 'FEDERAL',
          status: 'RESOLVIDO',
          observacao: '',
        },
      ];
      const MENSAGEM = 'valer para ao menos uma modalidade';

      function ofertando(...codigos: string[]): void {
        store.patchObjectSection('vagas', {
          ofertas: [
            {
              ofertaCursoId: 'oferta-1',
              voBase: '100',
              pr: '0,5',
              regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
              regraDistribuicaoVersao: 'v1',
              regraAjusteCodigo: 'AJUSTE-PADRAO',
              regraAjusteVersao: 'v1',
              referenciaReservaDemograficaId: 'ref-1',
              modalidades: codigos.map((codigo) => ({ id: `id-${codigo}`, codigo })),
              quadro: [],
            },
          ],
        });
      }

      function gatilhoDeModalidade(operador: string, valor: string): Record<string, unknown> {
        return {
          aplicabilidade: 'CONDICIONAL',
          condicoes: [{ clausula: 0, ordem: 0, fato: 'MODALIDADE', operador, valor }],
        };
      }

      function acusaOrfa(): boolean {
        return (conferencia.validar().messages ?? []).some((m) => m.includes(MENSAGEM));
      }

      it('acusa o gatilho IGUAL que não alcança nenhuma modalidade ofertada', () => {
        ofertando('LB_Q');
        comExigenciaDeclarada(NORMA_RESOLVIDA, gatilhoDeModalidade('IGUAL', '"LB_PPI"'));

        expect(acusaOrfa()).toBe(true);
      });

      it('não acusa o gatilho IGUAL que alcança uma modalidade ofertada', () => {
        ofertando('LB_Q', 'LB_PPI');
        comExigenciaDeclarada(NORMA_RESOLVIDA, gatilhoDeModalidade('IGUAL', '"LB_PPI"'));

        expect(acusaOrfa()).toBe(false);
      });

      it('acusa o gatilho NAO_EM que exclui toda modalidade ofertada', () => {
        ofertando('LB_Q');
        comExigenciaDeclarada(NORMA_RESOLVIDA, gatilhoDeModalidade('NAO_EM', '["LB_Q"]'));

        expect(acusaOrfa()).toBe(true);
      });

      it('não acusa o gatilho NAO_EM que deixa passar alguma modalidade ofertada', () => {
        ofertando('LB_Q', 'LB_PPI');
        comExigenciaDeclarada(NORMA_RESOLVIDA, gatilhoDeModalidade('NAO_EM', '["LB_Q"]'));

        expect(acusaOrfa()).toBe(false);
      });
    });

    /**
     * A recusa de complementação é do passo do CRONOGRAMA, não da superfície da fase: aquela
     * é embutida com `faseFixada` e o `validar()` dela nunca é chamado pela página. Escrita
     * lá, a conferência existia e não rodava.
     */
    it('acusa o reenvio declarado em fase que não admite complementação', () => {
      comExigenciaDeclarada(
        [
          {
            referencia: 'Lei 12.711/2012',
            abrangencia: 'FEDERAL',
            status: 'RESOLVIDO',
            observacao: '',
          },
        ],
        { consequenciaIndeferimento: 'PENDENCIA_REENVIO' },
      );

      const resultado = conferencia.validar();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('complementação');
    });

    /**
     * O documento da isenção numa fase que passou a responder só a inscrição não vira documento da
     * inscrição — que seria cobrado de todo candidato: o passo barra até o operador escolher.
     */
    it('barra o documento cujo formulário declarado a fase não responde mais', () => {
      comExigenciaDeclarada(
        [
          {
            referencia: 'Lei 12.711/2012',
            abrangencia: 'FEDERAL',
            status: 'RESOLVIDO',
            observacao: '',
          },
        ],
        { faseCodigo: 'COLETA_INSCRICAO', finalidade: 'ISENCAO_TAXA' },
      );
      comFases(ID_INSCRICAO);

      const resultado = conferencia.validar();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain(
        'sem o formulário em que o candidato o apresenta',
      );
    });

    /**
     * O documento que vale em todas as fases só ganha a cópia da fase acrescentada depois na
     * gravação. A conferência olha o que vai ser gravado: a fase nova que divide inscrição e
     * isenção pede a escolha do formulário antes do envio, e não numa recusa do servidor.
     */
    it('confere o formulário da cópia na fase acrescentada depois do regime de todas as fases', () => {
      comExigenciaDeclarada(
        [
          {
            referencia: 'Lei 12.711/2012',
            abrangencia: 'FEDERAL',
            status: 'RESOLVIDO',
            observacao: '',
          },
        ],
        { faseCodigo: 'COLETA_INSCRICAO', finalidade: 'INSCRICAO' },
      );
      store.patchSection('documentos', {
        ...store.draft().documentos,
        emTodasAsFases: ['01960000-0000-7000-0000-0000000000d9'],
      });
      comFases(ID_INSCRICAO);
      const inscricao = store.draft().cronograma.fases[0];
      store.patchObjectSection('cronograma', {
        fases: [
          inscricao,
          {
            ...inscricao,
            faseCanonicaId: ID_AVALIACAO,
            codigo: 'DIVIDIDA',
            ordem: 2,
            congelados: {
              origemData: 'NO_EDITAL',
              agrupaEtapas: false,
              coletaInscricao: true,
              permiteComplementacao: false,
              coletaSolicitacaoIsencao: true,
              bancas: [],
            },
          },
        ],
      });
      detectar();

      const resultado = conferencia.validar();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain(
        'sem o formulário em que o candidato o apresenta',
      );
    });

    /** Exigência ancorada em fase que saiu do cronograma é nomeada, não descartada em silêncio. */
    it('acusa a exigência cuja fase saiu do cronograma', () => {
      comExigenciaDeclarada([
        {
          referencia: 'Lei 12.711/2012',
          abrangencia: 'FEDERAL',
          status: 'RESOLVIDO',
          observacao: '',
        },
      ]);
      // A fase sai depois de a exigência ter sido declarada nela.
      comFases(ID_INSCRICAO);

      const resultado = conferencia.validar();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.join(' ')).toContain('saiu do cronograma');
    });
  });
});
