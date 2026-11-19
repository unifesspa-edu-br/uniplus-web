import { ModoDeDeliberacao, StatusProcesso } from '@uniplus/shared-data/selecao';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  ATO_INDIVIDUAL,
  COLEGIADA,
  comRegra,
} from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';
import { fase, ID_BANCA_HETERO, PROBLEM_JSON, PROCESSO_ID, ROTA_FASES } from './fase.testing';

const ID_DA_REGRA = 'fase-AVALIACAO-regra-0';
const SEM_RECORTE = { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [] };

describe('FasePassoComponent', () => {
  let componente: ContextoDaFase['componente'];
  let store: ContextoDaFase['store'];
  let controller: ContextoDaFase['controller'];
  let detectar: ContextoDaFase['detectar'];
  let nativo: ContextoDaFase['nativo'];
  let comCronograma: ContextoDaFase['comCronograma'];
  let bancasDaFase: ContextoDaFase['bancas'];
  let proximoPasso: () => Promise<unknown>;

  usarFase((tela) => {
    ({ componente, store, controller, detectar, nativo, comCronograma } = tela);
    bancasDaFase = tela.bancas;
    proximoPasso = () => new Promise((resolve) => setTimeout(resolve, 0));
  });

  const campo = <T extends HTMLElement>(sufixo: string) =>
    nativo.querySelector<T>(`#${ID_DA_REGRA}-${sufixo}`);
  const escolher = (sufixo: string, valor: string) => {
    const select = campo<HTMLSelectElement>(sufixo);
    if (select === null) throw new Error(`Seletor ${sufixo} não está na tela.`);
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    detectar();
  };
  const digitar = (sufixo: string, valor: string) => {
    const input = campo<HTMLInputElement>(sufixo);
    if (input === null) throw new Error(`Campo ${sufixo} não está na tela.`);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    detectar();
  };
  const digitarNaSegunda = (sufixo: string, valor: string) => {
    const input = nativo.querySelector<HTMLInputElement>(`#fase-AVALIACAO-regra-1-${sufixo}`);
    if (input === null) throw new Error(`Campo ${sufixo} não está na tela.`);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    detectar();
  };
  const regraDoRascunho = () =>
    store.draft().cronograma.fases[0].bancasRequeridas[0]?.regraDeDeliberacao;

  describe('regra de deliberação da banca requerida', () => {
    it('declara a banca sem regra, com o seletor de modo e nada mais', () => {
      comCronograma(fase({ bancasRequeridas: [{ ...SEM_RECORTE, regraDeDeliberacao: null }] }));

      expect(campo<HTMLSelectElement>('modo')?.value).toBe('');
      expect(campo('integrantes')).toBeNull();
    });

    it('cria a regra ao escolher o modo e a completa campo a campo', () => {
      comCronograma(fase({ bancasRequeridas: [{ ...SEM_RECORTE, regraDeDeliberacao: null }] }));

      escolher('modo', ModoDeDeliberacao.colegiadaComVotacao);
      digitar('integrantes', '5');
      escolher('encerramento', 'presidenciaNoQuorum');
      digitar('quorum', '3');
      escolher('criterio', 'maioriaSimples');
      escolher('desempate', 'votoDaPresidencia');
      digitar('suplentes', '2');

      expect(regraDoRascunho()).toEqual(COLEGIADA);
      expect(componente.erroDoCampo('bancasRequeridas.0.quorum')).toBeNull();
    });

    it('cobra sob o campo o que a regra ainda não tem, antes de gravar', () => {
      comCronograma(
        fase({
          bancasRequeridas: [{ ...SEM_RECORTE, regraDeDeliberacao: comRegra({ criterio: '' }) }],
        }),
      );

      expect(campo('criterio-erro')?.textContent).toContain('Escolha o critério');
      expect(campo('criterio')?.getAttribute('aria-invalid')).toBe('true');
      expect(campo('quorum-erro')).toBeNull();
    });

    it('volta a banca a sem regra ao escolher a opção de não declará-la', () => {
      comCronograma(
        fase({ bancasRequeridas: [{ ...SEM_RECORTE, regraDeDeliberacao: COLEGIADA }] }),
      );

      escolher('modo', '');

      expect(regraDoRascunho()).toBeNull();
      expect(campo('integrantes')).toBeNull();
    });

    it('declara o ato individual sem votação e sem nada a cobrar', () => {
      comCronograma(
        fase({ bancasRequeridas: [{ ...SEM_RECORTE, regraDeDeliberacao: COLEGIADA }] }),
      );

      escolher('modo', ModoDeDeliberacao.atoIndividual);
      digitar('integrantes', '1');
      digitar('suplentes', '0');

      expect(regraDoRascunho()).toEqual(ATO_INDIVIDUAL);
      expect(campo('criterio')).toBeNull();
    });

    it('não aceita edição enquanto uma gravação corre', () => {
      comCronograma(
        fase({ bancasRequeridas: [{ ...SEM_RECORTE, regraDeDeliberacao: COLEGIADA }] }),
      );

      store.salvando.set(true);
      detectar();

      expect(campo<HTMLSelectElement>('modo')?.disabled).toBe(true);
      expect(campo<HTMLInputElement>('integrantes')?.disabled).toBe(true);
    });

    it('leva a recusa do servidor ao campo da regra que ela nomeia', async () => {
      store.processoSeletivoId.set(PROCESSO_ID);
      comCronograma(
        fase({ bancasRequeridas: [{ ...SEM_RECORTE, regraDeDeliberacao: COLEGIADA }] }),
      );

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_FASES).flush(
        {
          type: 'about:blank',
          title: 'Cronograma recusado',
          status: 422,
          code: 'uniplus.selecao.banca.quorum_fora_do_intervalo',
          traceId: '00000000000000000000000000000001',
          errors: [
            {
              field: 'fases[0].bancasRequeridas[0].regraDeDeliberacao.quorum',
              code: 'uniplus.selecao.banca.quorum_fora_do_intervalo',
              message: 'detalhe do servidor',
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
      );
      await proximoPasso();
      detectar();

      expect((await gravacao).valid).toBe(false);
      expect(campo('quorum-erro')?.textContent).toContain('entre 1 e o número de integrantes');
      expect(campo('quorum')?.getAttribute('aria-invalid')).toBe('true');
    });

    describe('com a recusa do servidor na segunda banca', () => {
      const OUTRO_TIPO = { tipoBancaId: 'outro-tipo', categoriasDocumentoIds: [] };

      async function recusarQuorumDaSegunda(): Promise<void> {
        store.processoSeletivoId.set(PROCESSO_ID);
        comCronograma(
          fase({
            bancasRequeridas: [
              { ...SEM_RECORTE, regraDeDeliberacao: COLEGIADA },
              { ...OUTRO_TIPO, regraDeDeliberacao: COLEGIADA },
            ],
          }),
        );
        const gravacao = componente.persistir();
        controller.expectOne(ROTA_FASES).flush(
          {
            type: 'about:blank',
            title: 'Cronograma recusado',
            status: 422,
            code: 'uniplus.selecao.banca.quorum_fora_do_intervalo',
            traceId: '00000000000000000000000000000001',
            errors: [
              {
                field: 'fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum',
                code: 'uniplus.selecao.banca.quorum_fora_do_intervalo',
                message: 'detalhe do servidor',
              },
            ],
          },
          { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
        );
        await proximoPasso();
        await gravacao;
        detectar();
      }

      it('não passa a recusa à banca que ocupa a posição depois de remover a anterior', async () => {
        await recusarQuorumDaSegunda();
        expect(componente.erroDoCampo('bancasRequeridas.1.quorum')).not.toBeNull();

        bancasDaFase().removerBanca(0);
        detectar();

        expect(componente.erroDoCampo('bancasRequeridas.0.quorum')).toBeNull();
        expect(componente.erroDoCampo('bancasRequeridas.1.quorum')).toBeNull();
      });

      it('some quando a regra da banca é corrigida', async () => {
        await recusarQuorumDaSegunda();

        digitarNaSegunda('quorum', '4');

        expect(componente.erroDoCampo('bancasRequeridas.1.quorum')).toBeNull();
      });
    });

    it('lê a regra em consulta como uma linha, sem campo nem seletor', () => {
      comCronograma(
        fase({ bancasRequeridas: [{ ...SEM_RECORTE, regraDeDeliberacao: COLEGIADA }] }),
      );
      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);
      detectar();

      const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
      expect(leitura).toContain('5 titulares, 2 suplentes; quórum 3; maioria simples');
      expect(campo('modo')).toBeNull();
    });

    it('lê em consulta a banca sem regra declarada como tal', () => {
      comCronograma(fase({ bancasRequeridas: [{ ...SEM_RECORTE, regraDeDeliberacao: null }] }));
      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);
      detectar();

      expect(nativo.textContent).toContain('Sem regra de deliberação declarada');
    });
  });
});
