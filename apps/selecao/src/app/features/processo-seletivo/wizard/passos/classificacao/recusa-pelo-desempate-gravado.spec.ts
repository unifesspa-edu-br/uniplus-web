import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { CatalogosDeClassificacao } from './catalogos-de-classificacao.service';

import {
  componente,
  controller,
  lerCadastroComPeso,
  linhaDoCadastro,
  montarEliminacao,
  store,
} from '../eliminacao/eliminacao.testing';
import {
  ErroDeCampoDaRecusa,
  prepararClassificacaoLocalComResolucao,
  recusarGravacao,
} from './recusa-da-gravacao.testing';

describe('recusa por um critério de desempate já gravado', () => {
  montarEliminacao();

  const FORA_DO_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_fora_do_quadro';
  const SEM_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_sem_quadro';
  const TEXTO_FORA_DO_QUADRO =
    'Um critério de desempate gravado cita área do ENEM que a resolução escolhida não tem em todos os grupos. No passo Desempate, retire a área — ou, se nenhuma área do critério sobrar, troque a regra dele ou remova-o — e grave o passo; ou escolha outra resolução.';
  const TEXTO_SEM_QUADRO = `Um critério de desempate gravado compara a nota de área do ENEM, que só existe com a classificação baseada no ENEM pela média ponderada. Troque a regra do critério ou remova-o no passo Desempate e grave o passo, ou marque o ENEM e a média ponderada no passo ${NOME_DO_PASSO_DA_FORMULA}.`;
  const TEXTO_SEM_QUADRO_NA_RESOLUCAO = `Um critério de desempate gravado compara a nota de área do ENEM, que exige o quadro da resolução de Peso por Área. Troque a regra do critério no passo Desempate e grave o passo, ou escolha a resolução no passo ${NOME_DO_PASSO_DA_FORMULA}.`;

  async function recusar(
    codigo: string,
    errors: readonly ErroDeCampoDaRecusa[],
  ): Promise<ValidacaoDoPasso> {
    prepararClassificacaoLocalComResolucao();
    const gravacao = componente.persistir();
    recusarGravacao({ title: 'Título genérico da raiz.', code: codigo, errors });
    return gravacao;
  }

  it('guarda com a recusa a última leitura do cadastro pedida: só uma pedida depois conta como posterior', async () => {
    lerCadastroComPeso(2);
    const catalogos = TestBed.inject(CatalogosDeClassificacao);
    // Uma leitura pedida antes da recusa e respondida depois dela não é posterior.
    catalogos.recarregarPesosAreaEnem(0);
    const emVoo = controller.expectOne((requisicao) =>
      requisicao.url.endsWith('/api/configuracao/pesos-area-enem'),
    );

    await recusar(FORA_DO_QUADRO, [
      { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: 'Critério 1.' },
    ]);
    emVoo.flush([linhaDoCadastro(2)]);

    expect(store.classificacao.leituraDoCadastroNaRecusaPeloDesempate()).toBe(2);
    expect(catalogos.pesosLidosNaLeitura()).toBe(2);
  });

  it('no campo da resolução, explica com o texto da tela e o guarda sob o campo', async () => {
    const resultado = await recusar(FORA_DO_QUADRO, [
      { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: 'Critério 1.' },
    ]);

    expect(resultado.messages).toEqual([TEXTO_FORA_DO_QUADRO]);
    // Guardada à parte da recusa da resolução, e mostrada sob o mesmo campo.
    expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(TEXTO_FORA_DO_QUADRO);
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
  });

  it('a resposta nova pelo desempate substitui a recusa antiga da resolução', async () => {
    store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa antiga da resolução.');

    await recusar(FORA_DO_QUADRO, [
      { field: 'resolucaoPesoAreaEnem', code: FORA_DO_QUADRO, message: 'Critério 1.' },
    ]);

    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
    expect(store.classificacao.recusaPeloDesempatePorArea()).toBe(TEXTO_FORA_DO_QUADRO);
  });

  it('sem quadro no campo da resolução, orienta a escolher a resolução', async () => {
    const resultado = await recusar(SEM_QUADRO, [
      { field: 'resolucaoPesoAreaEnem', code: SEM_QUADRO, message: 'Critério 1.' },
    ]);

    expect(resultado.messages).toEqual([TEXTO_SEM_QUADRO_NA_RESOLUCAO]);
  });

  it('noutro campo, explica com o texto da tela, sem o título genérico', async () => {
    const resultado = await recusar(SEM_QUADRO, [
      { field: 'baseadoEmEnem', code: SEM_QUADRO, message: 'Critério 1.' },
    ]);

    expect(resultado.messages).toEqual([TEXTO_SEM_QUADRO]);
    expect(store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
  });

  it('sem campo, explica pelo código da raiz', async () => {
    const resultado = await recusar(SEM_QUADRO, []);

    expect(resultado.messages).toEqual([TEXTO_SEM_QUADRO]);
  });

  it('com outro erro junto, mantém o título da raiz para ele', async () => {
    const resultado = await recusar(SEM_QUADRO, [
      { field: 'baseadoEmEnem', code: SEM_QUADRO, message: 'Critério 1.' },
      { field: 'regraOrdemAlocacaoCodigo', code: 'outro', message: 'Outro.' },
    ]);

    expect(resultado.messages).toEqual([TEXTO_SEM_QUADRO, 'Título genérico da raiz.']);
  });
});
