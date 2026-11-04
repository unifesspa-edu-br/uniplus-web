import { Injectable, computed, inject } from '@angular/core';

import { CatalogoDeAtos } from './catalogo-de-atos.service';
import { CatalogoDeBancas } from './catalogo-de-bancas.service';
import { CatalogoDeDocumentos } from './catalogo-de-documentos.service';
import { CatalogoDeFases } from './catalogo-de-fases.service';
import { CatalogoDeFatos } from './catalogo-de-fatos.service';
import { CatalogoDeRegras } from './catalogo-de-regras.service';
import { CatalogoDeTiposDeEtapa } from './catalogo-de-tipos-de-etapa.service';
import { CatalogoDeUnidadesDoCadastro } from './catalogo-de-unidades-do-cadastro.service';

const MENSAGEM_DE_FALHA =
  'Não foi possível carregar os catálogos de fases, bancas, categorias de documento, atos e regras. Tente novamente.';

/**
 * O estado conjunto dos catálogos que o cronograma e a configuração de cada fase exigem para
 * oferecer qualquer escolha: uma tela com um catálogo faltando ofereceria menos do que existe, e
 * o operador não teria como saber. Ou vêm todos, ou a tela mostra a falha e a nova tentativa.
 *
 * As unidades ficam de fora do estado conjunto — a falta delas só tira a escolha da unidade de
 * cada fase —, mas são carregadas junto. Vive na página do wizard, e não num passo, porque a
 * linha do tempo e a superfície por fase leem os mesmos catálogos.
 */
@Injectable()
export class SituacaoDosCatalogosDoCronograma {
  private readonly exigidos = [
    inject(CatalogoDeFases),
    inject(CatalogoDeBancas),
    inject(CatalogoDeTiposDeEtapa),
    inject(CatalogoDeAtos),
    inject(CatalogoDeDocumentos),
    inject(CatalogoDeFatos),
    inject(CatalogoDeRegras),
  ];
  private readonly unidades = inject(CatalogoDeUnidadesDoCadastro);

  readonly carregando = computed(() => this.exigidos.some((catalogo) => catalogo.carregando()));
  readonly erro = computed(() =>
    this.exigidos.some((catalogo) => catalogo.erro() !== null) ? MENSAGEM_DE_FALHA : null,
  );

  carregar(): void {
    this.unidades.carregar();
    this.exigidos.forEach((catalogo) => catalogo.carregar());
  }

  /**
   * Repete a rodada inteira, e não só o que falhou: refazer um catálogo e manter outro de uma
   * rodada anterior abriria a tela com dados de momentos diferentes.
   */
  recarregar(): void {
    this.unidades.recarregar();
    this.exigidos.forEach((catalogo) => catalogo.recarregar());
  }
}
