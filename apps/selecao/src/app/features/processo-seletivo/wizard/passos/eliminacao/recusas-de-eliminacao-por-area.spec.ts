import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';
import {
  RESOLUCAO,
  ROTA_CLASSIFICACAO,
  componente,
  controller,
  digitar,
  fixture,
  linhaDoCadastro,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from './eliminacao.testing';

describe('recusas da API para cortes por área', () => {
  montarEliminacao();
  const CORTE = {
    regraCodigo: 'ELIMINACAO_CORTE_EM_AREA',
    regraVersao: 'v1',
    etapaRef: '',
    notaMinima: '',
    minimo: '',
    areaCodigo: '',
  };

  /** Classificação ENEM pela média ponderada, com o cadastro da resolução lido. */
  function comCadastroLido(corte: number | null = null): void {
    prepararClassificacaoLocal();
    store.patchObjectSection('classificacao', {
      baseadoEmEnem: true,
      resolucaoPesoAreaEnem: RESOLUCAO,
    });
    TestBed.inject(CatalogosDeClassificacao).garantirPesosAreaEnem(0);
    controller
      .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem'))
      .flush([
        {
          ...linhaDoCadastro(1),
          areas: [{ codigo: 'REDACAO', rotulo: 'Redação', peso: 1, corte }],
        },
      ]);
    controller
      .expectOne((requisicao) => requisicao.url.endsWith('/api/configuracao/pesos-area-enem/areas'))
      .flush([
        { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
        { codigo: 'REDACAO', rotulo: 'Redação' },
      ]);
  }

  it('põe a recusa do servidor junto do campo, com aria-invalid, e a tira quando a regra muda', async () => {
    comCadastroLido();
    store.patchObjectSection('classificacao', {
      regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '400' }],
    });

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: 'about:blank',
        title: 'Recusada.',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 't',
        errors: [
          {
            field: 'regrasEliminacao[0]',
            code: 'uniplus.selecao.configuracao_classificacao.corte_em_area_repetido',
            message: 'repetido',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await gravacao;
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const area = raiz.querySelector('#elim-area-0');
    expect(area?.getAttribute('aria-invalid')).toBe('true');
    expect(area?.getAttribute('aria-describedby')).toContain('elim-area-erro-0');
    expect(raiz.querySelector('#elim-area-erro-0')?.textContent).toContain('já tem um corte');
    expect(raiz.querySelector('#elim-minimo-0')?.getAttribute('aria-invalid')).toBeNull();

    digitar('elim-minimo-0', '410');
    fixture.detectChanges();
    expect(raiz.querySelector('#elim-area-erro-0')).toBeNull();
  });

  it('traduz a recusa do servidor ao corte fora do quadro, nomeando a regra', async () => {
    comCadastroLido();
    store.patchObjectSection('classificacao', {
      regrasEliminacao: [{ ...CORTE, areaCodigo: 'REDACAO', minimo: '400' }],
    });

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: 'about:blank',
        title: 'Recusada.',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 't',
        errors: [
          {
            field: 'regrasEliminacao[0].areaCodigo',
            code: 'uniplus.selecao.configuracao_classificacao.corte_em_area_fora_do_quadro',
            message: 'fora',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    const resultado = await gravacao;

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toMatch(
      /^Regra de eliminação 1: a área não está em todos os grupos/,
    );
  });
});
