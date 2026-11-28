import { Injectable, computed, signal } from '@angular/core';
import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';

import { reservasComAsChavesDe, type ReservasDeChaves } from '../wizard/documento/chaves-tomadas';
import type { EdicaoDoDocumento } from '../wizard/documento/edicoes/secao-do-documento';
import { mesmoConteudo } from '../wizard/shared/conteudo-canonico';
import type { VersaoBaseDaRetificacao } from './versao-base-da-retificacao';

/**
 * O documento que a pessoa edita numa retificação, em memória, e a versão de que ele parte. Nada
 * é gravado durante a edição: o estado vive só neste serviço, provido pela página, e some com ela.
 */
@Injectable()
export class RetificacaoEmEdicao {
  readonly base = signal<VersaoBaseDaRetificacao | null>(null);
  readonly documento = signal<DocumentoDaConfiguracao | null>(null);

  /**
   * As chaves da versão base e as das partes criadas na edição: uma parte nova não reaproveita a
   * chave de outra que já saiu, nem a de uma que a edição criou e depois retirou.
   */
  readonly reservas = signal<ReservasDeChaves | null>(null);

  /** O documento difere da base. Edição desfeita volta a `false`. */
  readonly alterada = computed(() => {
    const base = this.base();
    return base !== null && !mesmoConteudo(this.documento(), base.documento);
  });

  /** Começa a edição sobre uma versão lida, descartando o que havia. */
  abrir(base: VersaoBaseDaRetificacao): void {
    this.base.set(base);
    this.documento.set(base.documento);
    this.reservas.set(reservasDaBase(base));
  }

  /** Aplica uma edição pura ao documento; sem base aberta, não há o que editar. */
  aplicar(edicao: EdicaoDoDocumento): void {
    if (this.base() === null) return;
    this.documento.update((atual) => (atual === null ? atual : edicao(atual)));
    const editado = this.documento();
    if (editado !== null)
      this.reservas.update((atuais) => atuais && reservasComAsChavesDe(atuais, editado));
  }

  /** Volta o documento à base; a base e o ETag continuam os mesmos. */
  descartar(): void {
    const base = this.base();
    if (base === null) return;
    this.documento.set(base.documento);
    this.reservas.set(reservasDaBase(base));
  }

  /** Esquece base e documento, quando a página passa a outro processo. */
  fechar(): void {
    this.base.set(null);
    this.documento.set(null);
    this.reservas.set(null);
  }
}

function reservasDaBase(base: VersaoBaseDaRetificacao): ReservasDeChaves {
  return { original: base.documento, criadas: [] };
}
