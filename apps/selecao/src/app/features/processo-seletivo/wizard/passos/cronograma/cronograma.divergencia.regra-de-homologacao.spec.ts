import { type RegraDeHomologacaoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { faseDoServidor } from '../../shared/cronograma-do-servidor.testing';
import { regraDoDto } from '../../shared/homologacao/regra-de-homologacao-contrato';
import {
  EDICOES_DA_REGRA_DO_SERVIDOR,
  REGRA_DE_HOMOLOGACAO_ALTERADA_NO_SERVIDOR,
  REGRA_DE_HOMOLOGACAO_DO_SERVIDOR,
} from '../../shared/homologacao/regra-de-homologacao.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  ID_AVALIACAO,
  ID_BANCA_HETERO,
  PROCESSO_COM_ETAPA_GRAVADA,
  PROCESSO_ID,
  ROTA_FASES,
  ROTA_PROCESSO,
} from './cronograma.testing';

const SEM_CONTEUDO = { status: 204, statusText: 'No Content' };
const REGRA = regraDoDto(REGRA_DE_HOMOLOGACAO_DO_SERVIDOR);
const BANCA_ACRESCENTADA = {
  id: null,
  identificadorLocal: 'nova',
  copiaDoTipo: null,
  tipoBancaId: ID_BANCA_HETERO,
  categoriasDocumentoIds: [],
  regraDeDeliberacao: null,
};

describe('Cronograma: a regra de homologação na releitura que diverge', () => {
  let tela: ContextoDoCronograma;
  usarCronograma((contexto) => {
    tela = contexto;
  });

  /** O servidor devolve a fase sem as bancas enviadas, o que faz a tela mostrar o que ele tem. */
  const processoComAFaseLida = (regraLida: RegraDeHomologacaoDto | null | undefined) => ({
    ...PROCESSO_COM_ETAPA_GRAVADA,
    cronogramaFases: [
      faseDoServidor({
        faseCanonica: { origemId: ID_AVALIACAO, agrupaEtapas: true },
        bancasRequeridas: [],
        publicacoes: { regraDeHomologacao: regraLida },
      }),
    ],
  });

  async function gravarComAReleituraDivergente(
    regraNoRascunho: typeof REGRA,
    regraLida: RegraDeHomologacaoDto | null | undefined,
  ): Promise<void> {
    tela.store.processoSeletivoId.set(PROCESSO_ID);
    tela.store.patchObjectSection('classificacao', {
      edicoesEnem: [...EDICOES_DA_REGRA_DO_SERVIDOR],
    });
    tela.comFaseAjustada(ID_AVALIACAO, {
      bancasRequeridas: [BANCA_ACRESCENTADA],
      regraDeHomologacao: regraNoRascunho,
    });
    tela.comUmaEtapa();
    const gravacao = tela.componente.persistir();
    tela.controller.expectOne(ROTA_FASES).flush(null, SEM_CONTEUDO);
    await tela.proximoPasso();
    tela.controller.expectOne(ROTA_PROCESSO).flush(processoComAFaseLida(regraLida));
    await gravacao;
    tela.detectar();
  }

  async function regraEnviadaNaGravacaoSeguinte(): Promise<unknown> {
    const gravacao = tela.componente.persistir();
    const pedido = tela.controller.expectOne(ROTA_FASES);
    pedido.flush(null, SEM_CONTEUDO);
    await tela.proximoPasso();
    await tela.gravouEtapas();
    await tela.gravouExigencias();
    await gravacao;
    return (pedido.request.body as { regraDeHomologacao: unknown }[])[0].regraDeHomologacao;
  }

  it('mostra sem regra a fase que a leitura traz sem regra, e a gravação seguinte envia nula', async () => {
    await gravarComAReleituraDivergente(REGRA, null);

    expect(tela.store.draft().cronograma.fases[0].regraDeHomologacao).toBeNull();
    expect(await regraEnviadaNaGravacaoSeguinte()).toBeNull();
  });

  it('mantém sem regra a fase de que a pessoa retirou a regra', async () => {
    await gravarComAReleituraDivergente(null, null);

    expect(tela.store.draft().cronograma.fases[0].regraDeHomologacao).toBeNull();
    expect(await regraEnviadaNaGravacaoSeguinte()).toBeNull();
  });

  it('mostra a regra que a leitura traz, e não a do rascunho', async () => {
    await gravarComAReleituraDivergente(REGRA, REGRA_DE_HOMOLOGACAO_ALTERADA_NO_SERVIDOR);

    expect(tela.store.draft().cronograma.fases[0].regraDeHomologacao).toEqual(
      regraDoDto(REGRA_DE_HOMOLOGACAO_ALTERADA_NO_SERVIDOR),
    );
  });
});
