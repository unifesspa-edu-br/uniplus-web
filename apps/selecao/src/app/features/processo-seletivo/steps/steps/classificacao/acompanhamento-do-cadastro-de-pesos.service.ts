import { Injectable, Injector, computed, effect, inject, untracked } from '@angular/core';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { quadroDoCadastro, type GrupoDoQuadro } from '../../shared/quadro-de-pesos';
import { CatalogosDeClassificacaoService } from './catalogos-de-classificacao.service';
import { exigeResolucaoPesoAreaEnem } from './classificacao-para-comando';

/** O cadastro de Peso por Área como os passos o conferem. */
export interface LeituraDoCadastro {
  /** O cadastro em mãos foi lido para a versão atual da classificação: pode julgar. */
  readonly lido: boolean;
  /** Uma leitura está em curso. */
  readonly carregando: boolean;
  readonly falha: string | null;
  /** O número, dado no pedido, da última leitura que deu certo. */
  readonly leitura: number;
  /** O número da última leitura pedida: uma leitura com número maior foi pedida depois. */
  readonly pedida: number;
  /** O quadro da resolução escolhida no rascunho, como o cadastro em mãos o tem. */
  readonly quadroDaResolucaoEscolhida: readonly GrupoDoQuadro[];
  /** A lista canônica das áreas: a ordem de qualquer quadro e o rótulo de qualquer área. */
  readonly canonicas: readonly { readonly codigo: string; readonly rotulo: string }[];
}

/**
 * O cadastro de Peso por Área como o editor o usa, uma vez para a página inteira: o quadro da
 * resolução escolhida no rascunho — o que a próxima gravação da classificação copia —, a leitura
 * que os passos conferem, e a releitura a pedido do operador.
 *
 * O cadastro só julga quando foi lido para a versão atual da classificação. As linhas de uma
 * leitura anterior continuam em mãos como prévia — o seletor da resolução não perde as opções se
 * a releitura falhar —, mas não provam nada.
 */
@Injectable()
export class AcompanhamentoDoCadastroDePesos {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDeClassificacaoService);
  private readonly injector = inject(Injector);
  private acompanhando = false;

  /** Só a resolução: uma tecla em outro campo do rascunho não refaz o quadro. */
  private readonly resolucaoEscolhida = computed(
    () => this.store.draft().classificacao.resolucaoPesoAreaEnem,
  );

  readonly quadroDaResolucaoEscolhida = computed(() =>
    quadroDoCadastro(this.catalogos.pesosAreaEnem(), this.resolucaoEscolhida()),
  );

  private readonly lido = computed(
    () => this.catalogos.pesosLidosNaMarca() === this.store.versaoDaClassificacaoLida(),
  );

  readonly leitura = computed<LeituraDoCadastro>(() => ({
    lido: this.lido(),
    carregando: this.catalogos.pesosCarregando(),
    falha: this.catalogos.pesosErro(),
    leitura: this.catalogos.pesosLidosNaLeitura(),
    pedida: this.catalogos.pesosLeituraPedida(),
    quadroDaResolucaoEscolhida: this.quadroDaResolucaoEscolhida(),
    canonicas: this.catalogos.areasEnem(),
  }));

  /**
   * A resolução está fora do cadastro — e o cliente pode afirmar isso: o cadastro foi lido para a
   * versão atual. Sem essa leitura, "não achei" é só "ainda não sei", e nada é acusado.
   */
  readonly resolucaoForaDoCadastro = (resolucao: string): boolean =>
    resolucao.trim() !== '' &&
    this.lido() &&
    !this.catalogos.resolucoesPesoAreaEnem().includes(resolucao);

  /**
   * Mantém o cadastro lido. Chamado pelos passos que mostram o quadro; repetir a chamada não abre
   * outro acompanhamento.
   *
   * O cadastro só é lido quando a classificação exige a resolução, e o processo aceita edição ou
   * não tem cópia congelada em vigor: sem ENEM ou com a nota importada não há o que escolher, e só
   * para consulta basta a lista canônica das áreas para ordenar a cópia. Sem a cópia, porém, o
   * quadro só pode vir do cadastro, e não lê-lo deixaria a tela esperando para sempre. A leitura se
   * repete a cada leitura da classificação que muda o que se sabia dela, para o cadastro em mãos
   * ser posterior ao que o processo congelou.
   */
  acompanhar(): void {
    if (this.acompanhando) return;
    this.acompanhando = true;
    const exigeResolucao = computed(() =>
      exigeResolucaoPesoAreaEnem(this.store.draft().classificacao),
    );

    effect(
      () => {
        if (!exigeResolucao()) return;
        const marca = this.store.versaoDaClassificacaoLida();
        if (this.store.edicaoPermitida() || this.store.copiaCongeladaEmVigor() === null) {
          untracked(() => this.catalogos.garantirPesosAreaEnem(marca));
        } else {
          untracked(() => this.catalogos.garantirAreasEnem());
        }
      },
      { injector: this.injector },
    );
  }

  /**
   * Relê o cadastro a pedido do operador — ele pode ter completado a resolução na outra aba. A
   * recusa guardada da resolução, que julgou o cadastro de antes, deixa de valer: a próxima
   * gravação julga de novo. `depoisDeLer` só roda quando a leitura dá certo.
   */
  relerCadastroAPedido(depoisDeLer: () => void): void {
    this.catalogos.recarregarPesosAreaEnem(this.store.versaoDaClassificacaoLida(), () => {
      this.store.recusaDaResolucaoPesoAreaEnem.set(null);
      depoisDeLer();
    });
  }
}
