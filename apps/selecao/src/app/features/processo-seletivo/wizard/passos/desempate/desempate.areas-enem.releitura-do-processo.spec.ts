import { SituacaoDoProcessoSeletivoCodigo } from '@uniplus/shared-data/selecao';
import { afterEach, describe, expect, it } from 'vitest';

import {
  PROCESSO_ID,
  RESOLUCAO,
  ROTA_DETALHE,
  ERRO_500,
  QUADRO_CONGELADO,
  criterio,
} from './desempate.areas-enem.dados.testing';
import {
  montar,
  responderPendentes,
  classificacaoGravada,
  seletor,
  opcoesDoSeletor,
  textoDaTela,
  edicaoDosCriterios,
  areasDoDesempate,
  type Montagem,
  conferirERestaurar,
} from './desempate.areas-enem.montagem.testing';

describe('DesempatePassoComponent — ordem das áreas do ENEM: releitura do processo', () => {
  afterEach(conferirERestaurar);

  describe('com a classificação gravada desconhecida', () => {
    async function montarDesconhecida(): Promise<Montagem> {
      const m = await montar({
        antesDeMontar: (store) => {
          store.processoSeletivoId.set(PROCESSO_ID);
          store.patchSection('desempate', [criterio(['REDACAO'])]);
          classificacaoGravada(RESOLUCAO, QUADRO_CONGELADO)(store);
          store.classificacao.marcarDesconhecida();
        },
      });
      return m;
    }

    it('não oferece áreas nem as julga, e pede a releitura do processo', async () => {
      const m = await montarDesconhecida();

      expect(seletor(m, 0)).toBeNull();
      expect(m.el.querySelector('#desemp-reler-processo')).not.toBeNull();
      expect(m.componente.validar()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: não se sabe o que a classificação gravada tem agora, porque a última gravação ficou sem resposta ou a releitura do processo falhou, e as áreas que o desempate pode citar dependem disso; releia o processo pelo aviso no início do passo.',
        ],
      });
    });

    it('relido o processo, volta a oferecer as áreas do que ele tem e leva o foco ao critério', async () => {
      const m = await montarDesconhecida();

      const releitura = m.componente.relerProcesso();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DETALHE))
        .flush({
          id: PROCESSO_ID,
          situacao: {
            codigo: SituacaoDoProcessoSeletivoCodigo.RASCUNHO,
            rotulo: SituacaoDoProcessoSeletivoCodigo.RASCUNHO,
          },
          classificacao: {
            resolucaoPesoAreaEnem: RESOLUCAO,
            quadroPesoAreaEnem: QUADRO_CONGELADO,
          },
          criteriosDesempate: [],
        });
      await releitura;
      responderPendentes(m.controller);
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(m.el.querySelector('#desemp-reler-processo')).toBeNull();
      expect(opcoesDoSeletor(m, 0)).toEqual(['Linguagens']);
      expect(document.activeElement?.id).toBe('desemp-area-nova-0');
      // A leitura nova da classificação também relê o cadastro, que aqui não importa.
      responderPendentes(m.controller);
    });

    it('uma releitura superada não é anunciada como falha', async () => {
      const m = await montarDesconhecida();
      // Sem processo, a releitura não chega a decidir nada.
      m.store.processoSeletivoId.set(null);

      await m.componente.relerProcesso();

      expect(edicaoDosCriterios(m).anuncio()).toBe('');
    });

    it('se a releitura falha, o aviso fica e a falha é anunciada', async () => {
      const m = await montarDesconhecida();

      const releitura = m.componente.relerProcesso();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DETALHE))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      await releitura;
      m.fixture.detectChanges();

      expect(m.el.querySelector('#desemp-reler-processo')).not.toBeNull();
      expect(edicaoDosCriterios(m).anuncio()).toBe(
        'Não foi possível reler o processo. Tente novamente.',
      );
    });
  });

  describe('com a cópia gravada por confirmar', () => {
    async function montarPorConfirmar(): Promise<Montagem> {
      return montar({
        antesDeMontar: (store) => {
          store.processoSeletivoId.set(PROCESSO_ID);
          store.patchSection('desempate', [criterio(['REDACAO'])]);
          store.classificacao.registrarGravadaComQuadro(RESOLUCAO, []);
        },
      });
    }

    it('não oferece as áreas da cópia presumida, e pede a releitura para confirmá-la', async () => {
      const m = await montarPorConfirmar();

      expect(seletor(m, 0)).toBeNull();
      expect(m.el.querySelector('#desemp-reler-processo')).not.toBeNull();
      expect(textoDaTela(m)).toContain('ainda não foi confirmado');
      expect(m.componente.validar()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: o quadro de Peso por Área que a última gravação da classificação congelou no processo ainda não foi confirmado por uma releitura, e as áreas que o desempate pode citar dependem disso; releia o processo pelo aviso no início do passo.',
        ],
      });
    });

    it('se a releitura falha, a cópia continua por confirmar e a falha é anunciada', async () => {
      const m = await montarPorConfirmar();

      const releitura = m.componente.relerProcesso();
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_DETALHE))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      await releitura;
      m.fixture.detectChanges();

      expect(areasDoDesempate(m).situacaoDoQuadro()).toEqual({
        tipo: 'por-reler',
        motivo: 'por-confirmar',
      });
      expect(edicaoDosCriterios(m).anuncio()).toBe(
        'Não foi possível reler o processo. Tente novamente.',
      );
    });
  });
});
