import { Injectable, computed, inject } from '@angular/core';
import {
  acompanharCatalogo,
  destinoAcessivel,
  opcoesDosCodigos,
  type CatalogoAcompanhado,
  type UiSelectOption,
} from '@uniplus/shared-ui/components';
import { type TipoInstrumentoNormativoCodigo } from '@uniplus/shared-data/configuracao';
import { nullIfBlank } from '../../shared/formulario';
import { motivoDaFalha } from '../../shared/lista-de-referencia';
import { comPontoFinal } from '../../shared/texto';
import { CatalogoDeTiposDeInstrumento } from './catalogo-de-tipos-de-instrumento';

/** O que o formulário precisa saber do vocabulário de tipos de instrumento. */
export interface TiposDoFormulario {
  readonly leitura: CatalogoAcompanhado;
  readonly pendente: boolean;
  /** Verdadeiro quando o vocabulário chegou: só então o formulário pode ser enviado. */
  readonly disponivel: boolean;
  readonly opcoes: readonly UiSelectOption<TipoInstrumentoNormativoCodigo>[];
}

/**
 * Leitura do vocabulário de tipos de instrumento normativo para as opções do formulário. Cuida da
 * leitura acompanhada (falha, nova tentativa e foco).
 */
@Injectable()
export class TiposDeInstrumento {
  private readonly lista = inject(CatalogoDeTiposDeInstrumento).lista;
  private readonly motivo = motivoDaFalha(this.lista);

  readonly pendente = this.lista.pendente;

  /** A frase que explica a falha, com o motivo da API na frente quando ele existe. */
  private readonly mensagemDaFalha = computed(() => {
    const explicacao = 'Não é possível classificar a base legal sem o vocabulário de tipos.';
    const motivo = nullIfBlank(this.motivo());
    return motivo ? `${comPontoFinal(motivo)} ${explicacao}` : explicacao;
  });

  /**
   * A página e o formulário (um drawer) mostram a mesma leitura: uma só tentativa, uma só fase,
   * uma só mensagem. Ao dar certo, o foco vai ao select do tipo ou, sem o formulário, ao título.
   */
  readonly leitura: CatalogoAcompanhado = acompanharCatalogo({
    assunto: 'tipos de instrumento',
    falha: computed(() => (this.lista.falhou() ? this.mensagemDaFalha() : null)),
    pendente: this.pendente,
    recarregar: () => this.lista.tentarDeNovo(),
    destino: () =>
      destinoAcessivel(
        document.getElementById('cfg-blbr-tipo'),
        document.getElementById('cfg-base-legal-list-title'),
      ),
  });

  readonly formulario = computed<TiposDoFormulario>(() => ({
    leitura: this.leitura,
    pendente: this.pendente(),
    disponivel: !this.pendente() && !this.lista.falhou(),
    opcoes: opcoesDosCodigos(this.lista.opcoes()),
  }));

  constructor() {
    this.lista.garantirCarregado();
  }

  /** Prepara a leitura para um formulário que abre: tenta de novo a lista que falhou. */
  preparar(): void {
    this.lista.garantirCarregado();
  }
}
