import { TestBed } from '@angular/core/testing';
import { StatusProcesso, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';

import {
  RESOLUCAO,
  ROTA_CLASSIFICACAO,
  ROTA_DETALHE,
  aguardarReleitura,
  componente,
  controller,
  detalheCom,
  fixture,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from './eliminacao.testing';

describe('Eliminação diante do desempate por área', () => {
  montarEliminacao();

  describe('critério de desempate que compara a nota de área do ENEM', () => {
    const CRITERIO_POR_AREA = {
      regraCodigo: 'DESEMPATE-MAIOR-NOTA-AREA-ENEM',
      regraVersao: '1',
      etapaRef: '',
      idadeMinima: '',
      fato: '',
      operador: '',
      valor: '',
      areas: ['REDACAO', 'MATEMATICA'],
    };

    function lerCadastro(areasDaSaude: unknown[]): void {
      TestBed.inject(CatalogosDeClassificacao).garantirPesosAreaEnem(0);
      const grupo = (codigo: string, areas: unknown[]) => ({
        id: codigo,
        resolucao: RESOLUCAO,
        grupoCurso: { codigo, rotulo: codigo },
        areas,
        baseLegal: 'Anexo I',
        criadoEm: '2026-09-01T00:00:00Z',
      });
      controller
        .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
        .flush([
          grupo('TECNOLOGICA', [
            { codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null },
            { codigo: 'MATEMATICA', rotulo: 'Matemática', peso: 1, corte: null },
          ]),
          grupo('SAUDE_E_BIOLOGICAS', areasDaSaude),
        ]);
      controller
        .expectOne((requisicao) =>
          requisicao.url.endsWith('/api/configuracao/pesos-area-enem/areas'),
        )
        .flush([{ codigo: 'LINGUAGENS', rotulo: 'Linguagens' }]);
    }

    function classificacaoPeloEnem(): void {
      prepararClassificacaoLocal();
      store.patchObjectSection('classificacao', {
        baseadoEmEnem: true,
        resolucaoPesoAreaEnem: RESOLUCAO,
      });
    }

    /** Responde a gravação e a releitura, se saírem: a conferência recusada não chama a API. */
    async function gravar(): Promise<ValidacaoDoPasso> {
      const gravacao = componente.persistir();
      for (const pedido of controller.match(ROTA_CLASSIFICACAO)) {
        pedido.flush(null, { status: 204, statusText: 'No Content' });
      }
      await aguardarReleitura();
      for (const pedido of controller.match(ROTA_DETALHE)) {
        pedido.flush(detalheCom(RESOLUCAO, 2));
      }
      return gravacao;
    }

    it('recusa gravar a classificação sem ENEM, que deixaria o critério gravado sem a nota de área', async () => {
      prepararClassificacaoLocal();
      store.classificacao.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);

      const resultado = await gravar();

      expect(resultado).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1 gravado: compara a nota de área do ENEM, que só existe com a classificação baseada no ENEM pela média ponderada. Troque a regra do critério ou remova-o no passo Desempate e grave o passo, ou marque o ENEM e a média ponderada no passo Fórmula.',
        ],
      });
      controller.expectNone(ROTA_CLASSIFICACAO);
    });

    it('uma tecla em outro passo não refaz a conferência do desempate gravado', () => {
      lerCadastro([{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }]);
      classificacaoPeloEnem();
      store.classificacao.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);
      const antes = componente.avisoDoDesempatePorArea();

      store.patchObjectSection('identificacao', { nome: 'Processo de teste' });

      expect(componente.avisoDoDesempatePorArea()).toBe(antes);
    });

    it('pelo cadastro lido, só avisa da área que a resolução não tem em todos os grupos, e deixa o servidor julgar', async () => {
      lerCadastro([{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }]);
      classificacaoPeloEnem();
      store.classificacao.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);

      const aviso = `Pelo cadastro de Peso por Área lido, o critério de desempate 1 gravado cita Matemática, que a resolução ${RESOLUCAO} não tem em todos os grupos, e a gravação deve ser recusada: retire a área no passo Desempate e grave o passo, ou escolha outra resolução no passo Fórmula. Se o cadastro mudou, atualize a lista.`;
      expect(componente.avisoDoDesempatePorArea()).toEqual([aviso]);
      expect(componente.confirmacaoDeGravacao()?.aviso).toContain(aviso);
      // O cadastro lido pode estar velho: a gravação vai ao servidor.
      await expect(gravar()).resolves.toEqual({ valid: true });
    });

    it('só para consulta, não avisa de gravação nenhuma', () => {
      lerCadastro([{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }]);
      classificacaoPeloEnem();
      store.classificacao.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);
      store.remoteSnapshot.set({
        status: StatusProcesso.publicado,
      } as unknown as ProcessoSeletivoDto);

      expect(componente.avisoDoDesempatePorArea()).toEqual([]);
    });

    it('"Atualizar lista" do aviso relê o cadastro', () => {
      lerCadastro([{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }]);
      classificacaoPeloEnem();
      store.classificacao.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement)
        .querySelector<HTMLButtonElement>('#elim-atualizar-cadastro')
        ?.click();

      controller
        .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
        .flush([]);
    });

    it('grava a resolução que tem as áreas citadas em todos os grupos', async () => {
      lerCadastro([
        { codigo: 'MATEMATICA', rotulo: 'Matemática', peso: 1, corte: null },
        { codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null },
      ]);
      classificacaoPeloEnem();
      store.classificacao.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);

      await expect(gravar()).resolves.toEqual({ valid: true });
    });

    it('não confere o critério que só está no rascunho: o servidor confere o gravado', async () => {
      prepararClassificacaoLocal();
      store.patchSection('desempate', [CRITERIO_POR_AREA]);

      await expect(gravar()).resolves.toEqual({ valid: true });
    });

    it('não abre a confirmação de uma gravação que já se sabe recusada', () => {
      prepararClassificacaoLocal();
      expect(componente.confirmacaoDeGravacao()).not.toBeNull();

      store.classificacao.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);

      expect(componente.confirmacaoDeGravacao()).toBeNull();
    });

    it('sem saber o que está gravado, deixa o servidor decidir', async () => {
      prepararClassificacaoLocal();
      // O rascunho do desempate não é o que o servidor tem, e não serve de substituto.
      store.patchSection('desempate', [CRITERIO_POR_AREA]);
      store.classificacao.criteriosDesempateGravados.set(null);

      await expect(gravar()).resolves.toEqual({ valid: true });
    });

    it('com todas as áreas do critério fora, orienta a trocar a regra ou remover o critério', async () => {
      lerCadastro([{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null }]);
      classificacaoPeloEnem();
      store.classificacao.criteriosDesempateGravados.set([
        { ...CRITERIO_POR_AREA, areas: ['MATEMATICA'] },
      ]);

      expect(componente.avisoDoDesempatePorArea()).toEqual([
        `Pelo cadastro de Peso por Área lido, o critério de desempate 1 gravado cita Matemática, que a resolução ${RESOLUCAO} não tem em todos os grupos, e a gravação deve ser recusada: troque a regra do critério ou remova-o no passo Desempate e grave o passo, ou escolha outra resolução no passo Fórmula. Se o cadastro mudou, atualize a lista.`,
      ]);
    });

    it('nomeia pela lista canônica a área que a resolução não tem em grupo nenhum', async () => {
      lerCadastro([
        { codigo: 'MATEMATICA', rotulo: 'Matemática', peso: 1, corte: null },
        { codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte: null },
      ]);
      classificacaoPeloEnem();
      store.classificacao.criteriosDesempateGravados.set([
        { ...CRITERIO_POR_AREA, areas: ['REDACAO', 'LINGUAGENS'] },
      ]);

      expect(componente.avisoDoDesempatePorArea()[0]).toContain('cita Linguagens,');
    });

    it('a publicação não barra na validação o que a varredura corrige gravando o Desempate antes', async () => {
      prepararClassificacaoLocal();
      store.classificacao.criteriosDesempateGravados.set([CRITERIO_POR_AREA]);
      store.patchSection('desempate', [
        { ...CRITERIO_POR_AREA, regraCodigo: 'DESEMPATE-MAIOR-IDADE', areas: [] },
      ]);

      expect(componente.validar()).toEqual({ valid: true });

      // A varredura grava o Desempate, e o que está gravado passa a ser o rascunho.
      store.classificacao.criteriosDesempateGravados.set(store.draft().desempate);
      await expect(gravar()).resolves.toEqual({ valid: true });
    });
  });
});
