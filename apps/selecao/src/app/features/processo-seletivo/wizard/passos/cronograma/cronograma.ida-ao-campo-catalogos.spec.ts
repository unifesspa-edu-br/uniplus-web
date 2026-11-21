import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { CatalogoDeBancas } from './catalogos/catalogo-de-bancas.service';
import { SituacaoDosCatalogosDoCronograma } from './catalogos/situacao-dos-catalogos-do-cronograma.service';
import { ID_RESULTADO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDaPublicacaoRecusada,
  daFase,
  SEM_DEFINITIVO,
} from './cronograma-recusas-da-publicacao.testing';

describe('Ir ao campo enquanto os catálogos são lidos', () => {
  let tela: ContextoDoCronograma;
  let ajudantes: AjudantesDaPublicacaoRecusada;

  usarCronograma((montada) => {
    tela = montada;
    ajudantes = new AjudantesDaPublicacaoRecusada(montada);
    tela.comFases(ID_RESULTADO);
    ajudantes.recusar({
      field: 'fases[0].fim',
      code: SEM_DEFINITIVO,
      message: 'Informe o fim.',
      identificadores: [daFase('RESULTADO_FINAL')],
    });
  });

  it('preserva o destino enquanto os catálogos estão pendentes', async () => {
    TestBed.inject(CatalogoDeBancas).carregando.set(true);
    await ajudantes.irAoCampo(0);
    expect(ajudantes.publicacao.destino()).not.toBeNull();
    expect(tela.expansao.faseExpandida(0)).toBe(false);
  });

  it('preserva o destino na falha e foca o campo quando a nova tentativa termina', async () => {
    TestBed.inject(CatalogoDeBancas).erro.set('Falha ao carregar.');
    await ajudantes.irAoCampo(0);
    expect(ajudantes.publicacao.destino()).not.toBeNull();
    expect(tela.expansao.faseExpandida(0)).toBe(false);
    TestBed.inject(SituacaoDosCatalogosDoCronograma).recarregar();
    tela.detectar();
    expect(ajudantes.publicacao.destino()).not.toBeNull();
    for (const requisicao of tela.controller.match(() => true)) requisicao.flush([]);
    tela.detectar();
    await tela.proximoPasso();
    tela.detectar();
    expect(ajudantes.publicacao.destino()).toBeNull();
    expect(document.activeElement).toBe(tela.nativo.querySelector('#cr-fim-0'));
  });
});
