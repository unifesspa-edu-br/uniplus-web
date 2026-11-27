import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import {
  PROCESSO_ID,
  ROTA_DESEMPATE,
  ROTA_DETALHE,
  criterio,
} from './desempate.areas-enem.dados.testing';
import {
  montar,
  comQuadroGravado,
  type Montagem,
  conferirERestaurar,
} from './desempate.areas-enem.montagem.testing';

describe('DesempatePassoComponent — ordem das áreas do ENEM: gravação e recusas', () => {
  afterEach(conferirERestaurar);

  describe('gravação e recusas do servidor', () => {
    const FORA_DO_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_fora_do_quadro';
    const CITADA_POR_OUTRO =
      'uniplus.selecao.processo_seletivo.area_enem_citada_por_outro_criterio';

    const SEM_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_sem_quadro';

    async function gravarComRecusa(
      m: Montagem,
      codigo: string,
      errors: readonly { field: string; code: string; message: string }[],
    ) {
      m.store.processoSeletivoId.set(PROCESSO_ID);
      comQuadroGravado(m);
      const gravacao = m.componente.persistir();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DESEMPATE))
        .flush(
          {
            type: 'about:blank',
            title: 'Título genérico da raiz.',
            status: 422,
            code: codigo,
            traceId: 't',
            errors,
          },
          {
            status: 422,
            statusText: 'Unprocessable Entity',
            headers: { 'content-type': 'application/problem+json' },
          },
        );
      return gravacao;
    }

    it('sem resposta conclusiva da gravação, o desempate gravado fica desconhecido até a releitura', async () => {
      const m = await montar();
      m.store.processoSeletivoId.set(PROCESSO_ID);
      comQuadroGravado(m);
      m.store.patchSection('desempate', [criterio(['REDACAO'])]);

      const gravacao = m.componente.persistir();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DESEMPATE))
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      await new Promise((resolve) => setTimeout(resolve));

      expect(m.store.classificacao.criteriosDesempateGravados()).toBeNull();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DETALHE))
        .flush({
          id: PROCESSO_ID,
          classificacao: null,
          criteriosDesempate: [
            {
              ordem: 1,
              regra: { codigo: 'DESEMPATE_MAIOR_NOTA_AREA_ENEM', versao: '1' },
              parametros: { areas: ['REDACAO'] },
            },
          ],
        });
      await gravacao;

      expect(m.store.classificacao.criteriosDesempateGravados()).toEqual([criterio(['REDACAO'])]);
    });

    it('explica a área fora do quadro que o servidor recusa, com o critério e a área', async () => {
      const m = await montar();
      // A tela não vê problema; o servidor, com o que ele tem gravado, vê.
      m.store.patchSection('desempate', [criterio(['REDACAO']), criterio(['MATEMATICA'])]);

      const resultado = await gravarComRecusa(m, FORA_DO_QUADRO, [
        { field: 'criterios[1].areas[0]', code: FORA_DO_QUADRO, message: 'x' },
        { field: 'criterios[0].areas[0]', code: CITADA_POR_OUTRO, message: 'x' },
      ]);

      expect(resultado).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 2: a área Matemática não é comum a todos os grupos da resolução de Peso por Área.',
          'Critério de desempate 1: a área Redação já é citada por outro critério de desempate.',
        ],
      });
    });

    it('explica a falta de quadro que o servidor recusa, e mantém o título para o que não explica', async () => {
      const m = await montar();
      m.store.patchSection('desempate', [criterio(['REDACAO'])]);

      const resultado = await gravarComRecusa(m, SEM_QUADRO, [
        { field: 'criterios[0].regraCodigo', code: SEM_QUADRO, message: 'x' },
        { field: 'criterios[0].regraVersao', code: 'outro', message: 'x' },
      ]);

      expect(resultado).toEqual({
        valid: false,
        messages: [
          `Critério de desempate 1: a classificação gravada não tem o quadro de Peso por Área; escolha a resolução no passo ${NOME_DO_PASSO_DA_FORMULA}, se ainda não escolheu, e grave a classificação.`,
          'Título genérico da raiz.',
        ],
      });
    });

    it('uma releitura do processo anterior à gravação não desfaz os critérios gravados', async () => {
      const m = await montar();
      m.store.processoSeletivoId.set(PROCESSO_ID);
      comQuadroGravado(m);
      const antiga = TestBed.inject(ReleituraDoSnapshot).reler();
      const leituraAntiga = m.controller.expectOne((r) =>
        r.url.endsWith(`/api/selecao/processos-seletivos/${PROCESSO_ID}`),
      );
      m.store.patchSection('desempate', [criterio(['REDACAO'])]);

      const gravacao = m.componente.persistir();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DESEMPATE))
        .flush(null, { status: 204, statusText: 'No Content' });
      await gravacao;
      leituraAntiga.flush({ id: PROCESSO_ID, classificacao: null, criteriosDesempate: [] });
      await antiga;

      expect(m.store.classificacao.criteriosDesempateGravados()?.[0].areas).toEqual(['REDACAO']);
    });

    it('com a classificação desconhecida, relê o processo depois de gravar, já que descartou a releitura em curso', async () => {
      const m = await montar({
        antesDeMontar: (store) => {
          store.processoSeletivoId.set(PROCESSO_ID);
          store.classificacao.marcarDesconhecida();
        },
      });
      m.store.patchSection('desempate', [
        { ...criterio([]), regraCodigo: 'DESEMPATE_MAIOR_IDADE' },
      ]);

      const gravacao = m.componente.persistir();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DESEMPATE))
        .flush(null, { status: 204, statusText: 'No Content' });
      await new Promise((resolve) => setTimeout(resolve));

      m.controller
        .expectOne((r) => r.url.endsWith(`/api/selecao/processos-seletivos/${PROCESSO_ID}`))
        .flush({ id: PROCESSO_ID, classificacao: null, criteriosDesempate: [] });
      await expect(gravacao).resolves.toEqual({ valid: true });
      expect(m.store.classificacao.motivoDaReleitura()).not.toBe('desconhecida');
    });

    it('explica as recusas do servidor às áreas de um critério, nomeando o critério e a área', async () => {
      const m = await montar();
      m.store.processoSeletivoId.set(PROCESSO_ID);
      comQuadroGravado(m);
      m.store.patchSection('desempate', [criterio(['REDACAO']), criterio(['MATEMATICA'])]);
      const PREFIXO = 'uniplus.selecao.criterio_desempate.';

      const gravacao = m.componente.persistir();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DESEMPATE))
        .flush(
          {
            type: 'about:blank',
            title: 'Título genérico da raiz.',
            status: 422,
            code: `${PREFIXO}area_repetida`,
            traceId: 't',
            errors: [
              { field: 'criterios[0].areas[0]', code: `${PREFIXO}area_repetida`, message: 'x' },
              { field: 'criterios[1].areas[0]', code: `${PREFIXO}area_invalida`, message: 'x' },
              { field: 'criterios[1].areas', code: `${PREFIXO}areas_obrigatorias`, message: 'x' },
              { field: 'criterios[0].areas', code: `${PREFIXO}areas_em_excesso`, message: 'x' },
            ],
          },
          {
            status: 422,
            statusText: 'Unprocessable Entity',
            headers: { 'content-type': 'application/problem+json' },
          },
        );

      await expect(gravacao).resolves.toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a área Redação aparece mais de uma vez na ordem de desempate.',
          'Critério de desempate 2: a área Matemática não é uma área do ENEM.',
          'Critério de desempate 2: acrescente ao menos uma área do ENEM.',
          'Critério de desempate 1: o critério cita mais áreas do que o desempate admite.',
        ],
      });
    });
  });
});
