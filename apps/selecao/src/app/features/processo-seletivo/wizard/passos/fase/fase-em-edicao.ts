import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import type { FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { descreverFase, finalidadesDaFase } from '../../shared/descricao-da-fase';
import { CatalogoDeAtos } from '../cronograma/catalogos/catalogo-de-atos.service';
import { CatalogoDeBancas } from '../cronograma/catalogos/catalogo-de-bancas.service';
import { CatalogoDeFases } from '../cronograma/catalogos/catalogo-de-fases.service';
import {
  problemasDaFase,
  type AtoDoCatalogo,
  type CampoDaFase,
  type ProblemaDaFase,
} from './configuracao-da-fase';
import { produtosPreliminares } from './problemas-do-recurso-da-fase';
import { bancasEscolhiveis, nomeDaBanca } from './secoes/bancas-da-fase';
import { EspelhoDaFase } from './espelho-da-fase';
import { idDaFase } from './ids-da-fase';

/**
 * A fase como o seletor a apresenta: posição na linha do tempo e nome resolvido
 * pelo catálogo, ou pelo código quando a fase saiu dele.
 */
export interface FaseNoSeletor {
  readonly faseCanonicaId: string;
  readonly codigo: string;
  readonly ordem: number;
  readonly nome: string;
}

/**
 * O que as seções do passo da fase compartilham: qual fase está aberta, o formulário que a
 * espelha, o que a conferência e a última gravação recusaram por campo e o id de cada elemento.
 * Cada passo da fase tem a sua instância, porque o Cronograma embute um por fase.
 */
@Injectable()
export class FaseEmEdicao {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogoDeAtos = inject(CatalogoDeAtos);
  private readonly catalogoDeBancas = inject(CatalogoDeBancas);
  private readonly catalogoDeFases = inject(CatalogoDeFases);

  /** Fase aberta, pelo id da fase canônica — o identificador sempre presente. */
  readonly faseAberta = signal('');

  readonly espelho = new EspelhoDaFase(this.store);

  /** O que a última gravação recusou, por campo desta fase. */
  readonly recusaPorCampo = signal<ReadonlyMap<CampoDaFase, string>>(new Map());

  /** Recusas que não pertencem a nenhum campo da fase aberta. */
  readonly recusasGerais = signal<readonly string[]>([]);

  /** As fases do certame na ordem em que ocorrem. */
  readonly fasesDoCronograma = computed<readonly FaseDoCronograma[]>(() =>
    [...this.store.draft().cronograma.fases].sort((uma, outra) => uma.ordem - outra.ordem),
  );

  /** As fases como o seletor as nomeia. */
  readonly fasesNoSeletor = computed<readonly FaseNoSeletor[]>(() => {
    const fasePorId = this.catalogoDeFases.fasePorId();
    return this.fasesDoCronograma().map((fase) => ({
      faseCanonicaId: fase.faseCanonicaId,
      codigo: fase.codigo,
      ordem: fase.ordem,
      nome: descreverFase(fase, fasePorId).nome,
    }));
  });

  /** A fase aberta como o rascunho a guarda, ou `null` sem cronograma. */
  readonly faseDoRascunho = computed<FaseDoCronograma | null>(() => {
    const aberta = this.faseAberta();
    return this.fasesDoCronograma().find((fase) => fase.faseCanonicaId === aberta) ?? null;
  });

  /**
   * Os formulários que se respondem na fase aberta — onde o documento pode ser apresentado. Vazio
   * na fase que não responde formulário nenhum, e aí não há o que escolher.
   */
  readonly finalidadesDaFaseAberta = computed<readonly string[]>(() => {
    const fase = this.faseDoRascunho();
    return fase === null ? [] : finalidadesDaFase(fase, this.catalogoDeFases.fasePorId());
  });

  /** Nome da fase aberta, para o cabeçalho e para as mensagens. */
  readonly nomeDaFaseAberta = computed(() => {
    const aberta = this.faseAberta();
    return this.fasesNoSeletor().find((fase) => fase.faseCanonicaId === aberta)?.nome ?? '';
  });

  /** As publicações preliminares da fase — as únicas que podem ancorar o prazo. */
  readonly ancorasPossiveis = computed<readonly { codigo: string; nome: string }[]>(() => {
    const fase = this.faseDoRascunho();
    if (fase === null) return [];

    const rotulos = this.catalogoDeAtos.rotuloDoAto();
    return produtosPreliminares(fase.produtos).map((produto) => ({
      codigo: produto.atoCodigo,
      nome: rotulos.get(produto.atoCodigo) ?? produto.atoCodigo,
    }));
  });

  /** Publicação preliminar única, que dispensa escolha; `null` com zero ou duas. */
  readonly ancoraUnica = computed(() => {
    const possiveis = this.ancorasPossiveis();
    return possiveis.length === 1 ? possiveis[0].codigo : null;
  });

  /** A fase abre ciclo recursal: publica ao menos um resultado preliminar. */
  readonly publicaPreliminar = computed(() => this.ancorasPossiveis().length > 0);

  /** Bancas que o seletor oferece. */
  readonly bancasEscolhiveis = computed(() => {
    this.espelho.versao();
    const doCadastro = this.catalogoDeBancas.bancas().map((banca) => ({ id: banca.id, nome: banca.nome }));
    return bancasEscolhiveis(doCadastro, this.faseDoRascunho());
  });

  readonly atoPorCodigo = computed<ReadonlyMap<string, AtoDoCatalogo>>(
    () =>
      new Map(
        [...this.catalogoDeAtos.atoPorCodigo()].map(([codigo, ato]) => [
          codigo,
          { nome: ato.nome, ehResultado: ato.ehResultado },
        ]),
      ),
  );

  /** O que impede gravar a fase aberta, com o campo de cada recusa. */
  readonly problemas = computed<readonly ProblemaDaFase[]>(() => {
    const fase = this.faseDoRascunho();
    if (fase === null) return [];
    return problemasDaFase(fase, this.fasesDoCronograma(), this.atoPorCodigo(), (id) =>
      this.nomeDaBanca(id),
    );
  });

  /**
   * O que a tela mostra sob um campo: a conferência local, e a recusa que o
   * servidor devolveu por aquele mesmo campo. A conferência vem primeiro porque
   * descreve o estado atual — a recusa descreve o que foi enviado.
   */
  readonly erroDoCampo = (campo: CampoDaFase): string | null => {
    const local = this.problemas().find((problema) => problema.campo === campo);
    return local?.mensagem ?? this.recusaPorCampo().get(campo) ?? null;
  };

  readonly nomeDaBanca = (tipoBancaId: string): string =>
    nomeDaBanca(this.bancasEscolhiveis(), tipoBancaId);

  /**
   * O id de um elemento desta fase, único por instância. Todo id do template passa por aqui.
   */
  readonly idDaFase = (sufixo: string): string =>
    idDaFase(this.faseDoRascunho()?.codigo ?? '', sufixo);

  constructor() {
    // Outro processo entra em cena: a recusa que está na tela era do anterior.
    effect(() => {
      this.store.geracao();
      untracked(() => this.limparRecusa());
    });
  }

  limparRecusa(): void {
    this.recusaPorCampo.set(new Map());
    this.recusasGerais.set([]);
  }
}
