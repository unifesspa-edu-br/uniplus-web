import { Injectable, computed, inject } from '@angular/core';
import { VOCABULARIO_DE_TIPOS_DE_DECISAO } from '@uniplus/shared-data/configuracao';
import { acompanharLeitura, destinoAcessivel } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { tituloDoPasso } from '../../../shared/titulo-do-passo';

import { CatalogoDasOpcoesDoRecurso } from './catalogo-das-opcoes-do-recurso.service';
import { CatalogoDeAtos } from './catalogo-de-atos.service';
import { CatalogoDeBancas } from './catalogo-de-bancas.service';
import { CatalogoDeDocumentos } from './catalogo-de-documentos.service';
import { CatalogoDeFases } from './catalogo-de-fases.service';
import { CatalogoDeFatos } from './catalogo-de-fatos.service';
import { CatalogoDeMotivos } from './catalogo-de-motivos.service';
import { CatalogoDeRegras } from './catalogo-de-regras.service';
import { CatalogoDeTiposDeEtapa } from './catalogo-de-tipos-de-etapa.service';
import { CatalogoDeUnidadesDoCadastro } from './catalogo-de-unidades-do-cadastro.service';

const MENSAGEM_DE_FALHA =
  'Não foi possível carregar os catálogos de fases, bancas, categorias de documento, atos, regras, opções do recurso e tipos de decisão.';

/**
 * O estado conjunto dos catálogos que o cronograma e a configuração de cada fase exigem para
 * oferecer qualquer escolha: uma tela com um catálogo faltando ofereceria menos do que existe, e
 * o operador não teria como saber. Ou vêm todos, ou a tela mostra a falha e a nova tentativa.
 *
 * As unidades e os motivos de decisão ficam de fora do estado conjunto — a falta das unidades só
 * tira a escolha da unidade de cada fase, e a dos motivos só tira a escolha dos motivos —, mas são
 * carregados junto. Vive na página do wizard, e não num passo, porque a linha do tempo e a
 * superfície por fase leem os mesmos catálogos.
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
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly opcoesDoRecurso = inject(CatalogoDasOpcoesDoRecurso);
  private readonly tiposDeDecisao = inject(VOCABULARIO_DE_TIPOS_DE_DECISAO);
  private readonly unidades = inject(CatalogoDeUnidadesDoCadastro);
  private readonly motivos = inject(CatalogoDeMotivos);

  private readonly exigidosNestaTela = computed(() =>
    this.store.emConsulta()
      ? this.exigidos
      : [...this.exigidos, this.opcoesDoRecurso, this.tiposDeDecisao],
  );

  readonly carregando = computed(() =>
    this.exigidosNestaTela().some((catalogo) => catalogo.carregando()),
  );
  readonly erro = computed(() =>
    this.exigidosNestaTela().some((catalogo) => catalogo.erro() !== null)
      ? MENSAGEM_DE_FALHA
      : null,
  );

  /**
   * A falha dos catálogos com a nova tentativa, uma só para o Cronograma e a Fase, que leem os
   * mesmos catálogos. O foco volta ao subtítulo do Cronograma.
   */
  readonly leitura = acompanharLeitura({
    falha: this.erro,
    pendente: this.carregando,
    recarregar: () => this.recarregar(),
    destino: () => document.getElementById('sel-cronograma-subtitulo'),
  });

  /**
   * A falha das unidades com a nova tentativa, um aviso só para a tela inteira, e não um por fase.
   * O foco vai ao primeiro campo de unidade da tela ou, sem ele, à nova fase e, por fim, ao título
   * do passo.
   */
  readonly leituraDasUnidades = acompanharLeitura({
    falha: this.unidades.erro,
    pendente: this.unidades.carregando,
    recarregar: () => this.unidades.recarregar(),
    destino: () =>
      destinoAcessivel(
        document.querySelector<HTMLElement>('select[id^="cr-unidade-"]'),
        document.getElementById('cr-nova-fase'),
        tituloDoPasso(),
      ),
  });

  /**
   * A falha dos motivos de decisão com a nova tentativa, um aviso só para a tela inteira. O foco
   * vai ao título da primeira seção de motivos da tela ou, sem ela, ao título do passo.
   */
  readonly leituraDosMotivos = acompanharLeitura({
    falha: this.motivos.erro,
    pendente: this.motivos.carregando,
    recarregar: () => this.motivos.recarregar(),
    destino: () =>
      destinoAcessivel(
        document.querySelector<HTMLElement>(
          'sel-motivos-da-fase-ou-etapa .form-section__title[tabindex="-1"]',
        ),
        tituloDoPasso(),
      ),
  });

  carregar(): void {
    this.unidades.carregar();
    this.motivos.carregar();
    this.exigidos.forEach((catalogo) => catalogo.carregar());
    if (!this.store.emConsulta()) this.carregarDaEdicao();
  }

  /**
   * Repete a rodada inteira, e não só o que falhou: refazer um catálogo e manter outro de uma
   * rodada anterior abriria a tela com dados de momentos diferentes.
   */
  recarregar(): void {
    this.unidades.recarregar();
    this.motivos.recarregar();
    this.exigidos.forEach((catalogo) => catalogo.recarregar());
    if (!this.store.emConsulta()) this.recarregarDaEdicao();
  }

  private carregarDaEdicao(): void {
    this.opcoesDoRecurso.carregar();
    this.tiposDeDecisao.carregar();
  }

  private recarregarDaEdicao(): void {
    this.opcoesDoRecurso.recarregar();
    this.tiposDeDecisao.recarregar();
  }
}
