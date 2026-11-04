import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { CriterioDesempateConfigurado } from '../../processo-seletivo.models';
import { MOTIVO_DA_RELEITURA } from '../../shared/motivo-da-releitura';
import {
  ReleituraDoSnapshot,
  relerProcessoAPedido,
} from '../../shared/releitura-do-snapshot.service';
import { AcompanhamentoDoCadastroDePesos } from '../classificacao/acompanhamento-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';
import { desempateUsaAreas } from './desempate-para-comando';
import {
  areasCitadasPor,
  DEPENDEM_DA_RELEITURA,
  dicaDaSituacao,
  rotulosDasAreas,
  situacaoDoQuadro,
} from './situacao-do-quadro';

/** Como terminou o pedido de reler o processo. */
export type ResultadoDaReleitura = 'lida' | 'superada' | 'ainda-por-reler';

/**
 * As áreas do ENEM que os critérios por área do desempate podem citar: de onde vêm, quais ainda
 * podem entrar, por que faltam, e quando a gravação dos critérios espera pela classificação.
 *
 * O quadro vem do cadastro de Peso por Área ou da cópia que o processo congelou, e a lista
 * canônica dá o rótulo das citadas, qualquer que seja a origem do quadro.
 */
@Injectable()
export class AreasDoDesempate {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDeClassificacao);
  private readonly cadastroDePesos = inject(AcompanhamentoDoCadastroDePesos);
  private readonly releitura = inject(ReleituraDoSnapshot);

  private readonly criterios = computed(() => this.store.draft().desempate);

  readonly relendoProcesso = signal(false);

  constructor() {
    this.cadastroDePesos.acompanhar();
    this.acompanharListaCanonicaDasAreas();
  }

  /**
   * A lista canônica dá a ordem das áreas oferecidas e o rótulo das citadas, qualquer que seja a
   * origem do quadro — inclusive sem quadro ou com o cadastro em falha. O serviço não a pede de
   * novo enquanto a leitura do cadastro, que também a traz, está em curso; a que falhou é pedida de
   * novo a cada leitura da classificação que muda o que se sabia dela, e a cada leitura do
   * cadastro.
   */
  private acompanharListaCanonicaDasAreas(): void {
    effect(() => {
      this.store.classificacao.versaoLida();
      this.catalogos.pesosLidosNaLeitura();
      if (this.temCriterioPorArea()) untracked(() => this.catalogos.garantirAreasEnem());
    });
  }

  readonly temCriterioPorArea = computed(() =>
    this.criterios().some((criterio) => desempateUsaAreas(criterio.regraCodigo)),
  );

  /** Só a classificação: uma tecla em outro passo não chega ao quadro. */
  private readonly classificacao = computed(() => this.store.draft().classificacao);

  readonly situacaoDoQuadro = computed(() =>
    situacaoDoQuadro(
      this.classificacao(),
      this.store.classificacao.gravada(),
      this.cadastroDePesos.leitura(),
    ),
  );

  private readonly gruposDoQuadro = computed(() => {
    const situacao = this.situacaoDoQuadro();
    return 'grupos' in situacao ? situacao.grupos : [];
  });

  readonly areasAceitas = computed(() => {
    const situacao = this.situacaoDoQuadro();
    return situacao.tipo === 'lido' ? situacao.aceitas : [];
  });

  private readonly rotuloDaAreaPorCodigo = computed(() =>
    rotulosDasAreas(this.catalogos.areasEnem(), this.gruposDoQuadro()),
  );

  rotuloDaArea(codigo: string): string {
    return this.rotuloDaAreaPorCodigo().get(codigo) ?? codigo;
  }

  private readonly areasCitadas = computed(() => new Set(areasCitadasPor(this.criterios())));

  /**
   * As áreas que ainda podem entrar num critério: cada área é citada uma vez só, no critério e
   * entre os critérios por área — a segunda citação nunca desempataria ninguém.
   */
  readonly areasOferecidas = computed(() =>
    this.areasAceitas().filter((area) => !this.areasCitadas().has(area.codigo)),
  );

  /** Por que o seletor do critério está vazio: as áreas que faltam nele estão em outros critérios. */
  semAreaAOferecer(criterio: CriterioDesempateConfigurado): string {
    return this.areasAceitas().every((area) => criterio.areas.includes(area.codigo))
      ? 'Todas as áreas do quadro já estão na ordem'
      : 'As demais áreas do quadro já estão em outros critérios';
  }

  /** De onde vêm as áreas, ou por que não há nenhuma: a mesma dica para todo critério por área. */
  readonly dicaDaOrigem = computed(() => dicaDaSituacao(this.situacaoDoQuadro()));

  /**
   * A falha de leitura do cadastro, dita uma vez no passo, e só quando algum critério depende dele.
   * Vem da falha, e não da situação: a nova tentativa em curso deixa a situação "carregando", e o
   * alerta, com o botão focado, fica na tela até a leitura dar certo.
   */
  readonly falhaDoCadastroDePesos = computed(() => {
    const tipo = this.situacaoDoQuadro().tipo;
    const falha = this.cadastroDePesos.leitura().falha;
    return (tipo === 'falha' || tipo === 'carregando') && this.temCriterioPorArea() ? falha : null;
  });

  /** O aviso no início do passo, com o botão que relê o processo, quando algum critério depende dele. */
  readonly avisoDaReleitura = computed(() => {
    const situacao = this.situacaoDoQuadro();
    return situacao.tipo === 'por-reler' && this.temCriterioPorArea()
      ? `${MOTIVO_DA_RELEITURA[situacao.motivo]}, e ${DEPENDEM_DA_RELEITURA}. Releia o processo para saber o que ele tem.`
      : null;
  });

  /**
   * Os critérios por área só são gravados depois da classificação com o quadro: o servidor os
   * recusa enquanto o processo não tem o quadro congelado.
   */
  readonly adiaAGravacao = computed(
    () => this.temCriterioPorArea() && this.store.classificacao.copiaCongeladaEmVigor() === null,
  );

  /** A nota de que os critérios serão gravados junto com a classificação. */
  readonly gravaComAClassificacao = computed(
    () => this.store.aceitaEdicao() && this.adiaAGravacao(),
  );

  /**
   * "Reler o processo" do aviso de releitura. O aviso fica, com o botão focado, enquanto a leitura
   * corre. Uma leitura superada por outra, ou por uma troca de processo, não falhou: quem decide é
   * a mais nova.
   */
  async relerProcesso(): Promise<ResultadoDaReleitura> {
    if (!(await relerProcessoAPedido(this.releitura, this.relendoProcesso))) return 'superada';
    return this.situacaoDoQuadro().tipo === 'por-reler' ? 'ainda-por-reler' : 'lida';
  }

  /** "Tentar novamente" do cadastro de pesos: `aoLer` roda quando a leitura dá certo. */
  relerCadastro(aoLer: () => void): void {
    this.cadastroDePesos.relerCadastroAPedido(aoLer);
  }
}
