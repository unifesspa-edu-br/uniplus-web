import { computed, effect, inject, Injectable, Injector, signal, untracked } from '@angular/core';

import type { CriterioDesempateConfigurado } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { focarAposRenderizar } from '../../shared/foco-apos-renderizar';
import { lerChaveDaRegra } from '../classificacao/regra-escolhivel';
import { comAreaAcrescentada, comAreasTrocadas, semAreaNaPosicao } from './areas-do-criterio';
import { AreasDoDesempate } from './areas-do-desempate.service';

const CRITERIO_VAZIO: CriterioDesempateConfigurado = {
  regraCodigo: '',
  regraVersao: '',
  etapaRef: '',
  idadeMinima: '',
  fato: '',
  operador: '',
  valor: '',
  areas: [],
};

/**
 * A edição da lista de critérios no rascunho: acrescentar, remover, mover, trocar a regra e
 * alterar os campos de um critério ou as áreas dele, com o anúncio do que mudou e a área escolhida
 * no seletor e ainda não incluída, que acompanha a posição do critério.
 *
 * A ordem é a regra: o primeiro critério da lista desempata primeiro, e a das áreas dentro dele
 * também.
 */
@Injectable()
export class EdicaoDosCriterios {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly areas = inject(AreasDoDesempate);
  private readonly injector = inject(Injector);

  readonly criterios = computed(() => this.store.draft().desempate);

  constructor() {
    this.descartarEscolhasQueSairamDoSeletor();
    this.esquecerEscolhasQuandoAListaForSubstituida();
  }

  /**
   * As escolhas pendentes são das posições da lista que esta tela montou. Uma lista que chega de
   * fora — hidratação, releitura, troca de processo — põe outros critérios nessas posições, e as
   * escolhas caem.
   */
  private esquecerEscolhasQuandoAListaForSubstituida(): void {
    effect(() => {
      const criterios = this.criterios();
      if (criterios !== this.listaMontadaAqui) {
        untracked(() => this.escolhasPendentes.set(new Map()));
      }
    });
  }

  /** A última lista que esta tela gravou no rascunho. */
  private listaMontadaAqui: readonly CriterioDesempateConfigurado[] | null = null;

  private gravarNoRascunho(criterios: readonly CriterioDesempateConfigurado[]): void {
    this.listaMontadaAqui = criterios;
    this.store.patchSection('desempate', criterios);
  }

  /**
   * A escolha cuja área deixou de ser oferecida — citada por outro critério, ou fora do quadro —
   * cai: o seletor já mostra "— escolher —", e a área não pode voltar escolhida sem o operador ver.
   * Só com o quadro lido: enquanto ele carrega, nenhuma área é oferecida, e nada saiu do seletor.
   */
  private descartarEscolhasQueSairamDoSeletor(): void {
    effect(() => {
      if (this.areas.situacaoDoQuadro().tipo !== 'lido') return;
      const oferecidas = new Set(this.areas.areasOferecidas().map((area) => area.codigo));
      const escolhas = untracked(() => this.escolhasPendentes());
      const validas = [...escolhas].filter(([, codigo]) => oferecidas.has(codigo));
      if (validas.length < escolhas.size) this.escolhasPendentes.set(new Map(validas));
    });
  }

  acrescentar(): void {
    this.gravarNoRascunho([...this.criterios(), CRITERIO_VAZIO]);
    this.anunciar(`Critério ${this.criterios().length} acrescentado ao fim da lista.`);
  }

  remover(indice: number): void {
    this.gravarNoRascunho(this.criterios().filter((_, item) => item !== indice));
    this.remapearEscolhas((anterior) =>
      anterior === indice ? null : anterior > indice ? anterior - 1 : anterior,
    );
    this.anunciar(`Critério ${indice + 1} removido.`);
    // O botão clicado sai do DOM junto com a linha e o foco cairia no corpo da página. Quem
    // navega por teclado perderia o lugar a cada remoção.
    focarAposRenderizar(
      this.injector,
      `desemp-remover-${Math.max(0, indice - 1)}`,
      'desempate-acrescentar',
    );
  }

  /**
   * Troca de posição dois critérios. A ordem É a regra — o primeiro da lista desempata
   * primeiro —, então mover não é enfeite, é configuração.
   *
   * O foco acompanha o critério movido, e não a posição: as linhas são reusadas por posição, e
   * sem isto o botão que continuava focado passava a operar OUTRO critério, sem nada anunciar.
   * No topo e no fim o botão correspondente fica indisponível, e o foco vai para o par dele.
   */
  mover(indice: number, delta: number): void {
    const ordem = [...this.criterios()];
    const destino = indice + delta;
    if (destino < 0 || destino >= ordem.length) return;

    [ordem[indice], ordem[destino]] = [ordem[destino], ordem[indice]];
    this.gravarNoRascunho(ordem);
    this.remapearEscolhas((anterior) =>
      anterior === indice ? destino : anterior === destino ? indice : anterior,
    );

    this.anunciar(`Critério movido para a posição ${destino + 1} de ${ordem.length}.`);
    focarAposRenderizar(
      this.injector,
      delta < 0 ? `desemp-subir-${destino}` : `desemp-descer-${destino}`,
      delta < 0 ? `desemp-descer-${destino}` : `desemp-subir-${destino}`,
    );
  }

  /**
   * O que mudou na lista, para quem não vê a tela. Reordenar, acrescentar e remover eram
   * mudanças silenciosas para leitor de tela.
   */
  readonly anuncio = signal('');

  private ultimoAnuncio = '';
  private repeticoesDoAnuncio = 0;

  /**
   * Um anúncio idêntico ao anterior não muda a região viva, e o leitor de tela não o repete: a
   * partir da segunda vez seguida, o texto diz qual vez é.
   */
  anunciar(mensagem: string): void {
    this.repeticoesDoAnuncio = mensagem === this.ultimoAnuncio ? this.repeticoesDoAnuncio + 1 : 1;
    this.ultimoAnuncio = mensagem;
    this.anuncio.set(
      this.repeticoesDoAnuncio > 1 ? `${mensagem} (${this.repeticoesDoAnuncio}ª vez)` : mensagem,
    );
  }

  escolherRegra(indice: number, valor: string): void {
    const { codigo, versao } = lerChaveDaRegra(valor);
    this.remapearEscolhas((anterior) => (anterior === indice ? null : anterior));
    // Trocar de regra some com o que a variante anterior usava — CA-05: só os
    // argumentos aplicáveis à regra atual permanecem.
    this.atualizar(indice, {
      regraCodigo: codigo,
      regraVersao: versao,
      etapaRef: '',
      idadeMinima: '',
      fato: '',
      operador: '',
      valor: '',
      areas: [],
    });
  }

  /**
   * A área escolhida no seletor de cada critério, ainda não incluída, pela posição do critério. A
   * posição é a chave que a tela mantém: mover e remover critérios a acompanham, e mexer nas áreas
   * do próprio critério não a troca.
   */
  private readonly escolhasPendentes = signal<ReadonlyMap<number, string>>(new Map());

  escolhaPendente(indice: number): string {
    return this.escolhasPendentes().get(indice) ?? '';
  }

  /**
   * Só guarda a escolha. Incluir é outro gesto, pelo botão: no seletor fechado, cada seta dispara
   * `change`, e incluir ali acrescentaria uma área a cada tecla.
   */
  escolherArea(indice: number, codigo: string): void {
    this.escolhasPendentes.set(new Map([...this.escolhasPendentes(), [indice, codigo]]));
  }

  /** Leva as escolhas pendentes para as posições novas dos critérios; a de um removido cai. */
  private remapearEscolhas(posicaoNova: (anterior: number) => number | null): void {
    this.escolhasPendentes.set(
      new Map(
        [...this.escolhasPendentes()].flatMap(([anterior, codigo]) => {
          const nova = posicaoNova(anterior);
          return nova === null ? [] : [[nova, codigo] as const];
        }),
      ),
    );
  }

  acrescentarAreaEscolhida(indice: number): void {
    const criterio = this.criterios()[indice];
    if (criterio === undefined) return;
    const codigo = this.escolhaPendente(indice);
    if (!this.areas.areasOferecidas().some((area) => area.codigo === codigo)) {
      this.anunciar('Escolha no seletor a área a acrescentar.');
      focarAposRenderizar(this.injector, `desemp-area-nova-${indice}`);
      return;
    }

    const areas = comAreaAcrescentada(criterio.areas, codigo);
    this.atualizar(indice, { areas });
    this.anunciar(
      `Área ${this.areas.rotuloDaArea(codigo)} acrescentada ao critério ${indice + 1}, na posição ${areas.length}.`,
    );
    // Acrescentada a última área oferecida, o botão fica indisponível e perderia o foco.
    focarAposRenderizar(
      this.injector,
      `desemp-area-acrescentar-${indice}`,
      `desemp-area-remover-${indice}-${areas.length - 1}`,
    );
  }

  removerArea(indice: number, posicao: number): void {
    const criterio = this.criterios()[indice];
    if (criterio === undefined) return;

    const codigo = criterio.areas[posicao];
    this.atualizar(indice, { areas: semAreaNaPosicao(criterio.areas, posicao) });
    this.anunciar(`Área ${this.areas.rotuloDaArea(codigo)} retirada do critério ${indice + 1}.`);
    // O botão clicado sai do DOM com a linha: o foco vai para a área anterior; da primeira, para a
    // que passou a ocupar a posição dela; sem nenhuma, para o seletor de acrescentar e, quando ele
    // não está na tela, para a regra do critério.
    const vizinha = posicao > 0 ? posicao - 1 : 0;
    focarAposRenderizar(
      this.injector,
      `desemp-area-remover-${indice}-${vizinha}`,
      `desemp-area-nova-${indice}`,
      `desemp-regra-${indice}`,
    );
  }

  /** Troca de posição duas áreas do critério. A ordem é a regra: a primeira desempata primeiro. */
  moverArea(indice: number, posicao: number, delta: number): void {
    const criterio = this.criterios()[indice];
    const destino = posicao + delta;
    const areas =
      criterio === undefined ? null : comAreasTrocadas(criterio.areas, posicao, destino);
    if (areas === null) return;

    this.atualizar(indice, { areas });
    this.anunciar(
      `Área ${this.areas.rotuloDaArea(areas[destino])} movida para a posição ${destino + 1} de ${areas.length} no critério ${indice + 1}.`,
    );
    focarAposRenderizar(
      this.injector,
      delta < 0
        ? `desemp-area-subir-${indice}-${destino}`
        : `desemp-area-descer-${indice}-${destino}`,
      delta < 0
        ? `desemp-area-descer-${indice}-${destino}`
        : `desemp-area-subir-${indice}-${destino}`,
    );
  }

  atualizar(indice: number, patch: Partial<CriterioDesempateConfigurado>): void {
    this.gravarNoRascunho(
      this.criterios().map((criterio, item) =>
        item === indice ? { ...criterio, ...patch } : criterio,
      ),
    );
  }
}
