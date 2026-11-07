import { Injectable, computed, inject, signal } from '@angular/core';
import {
  acompanharCatalogo,
  destinoAcessivel,
  type CatalogoAcompanhado,
} from '@uniplus/shared-ui/components';
import { ResolucaoDeVinculo, resolverVinculo } from '@uniplus/shared-core/http';
import { type TipoInstrumentoNormativoVocabularioDto } from '@uniplus/shared-data/configuracao';
import { nullIfBlank } from '../../shared/formulario';
import { motivoDaFalha } from '../../shared/lista-de-referencia';
import { comPontoFinal } from '../../shared/texto';
import { CatalogoDeTiposDeInstrumento } from './catalogo-de-tipos-de-instrumento';

/** O código que a base em edição guarda e o vocabulário atual não oferece, com o texto da opção. */
export interface TipoForaDasOpcoes {
  readonly codigo: string;
  readonly rotulo: string;
}

/** O que o formulário precisa saber do vocabulário de tipos de instrumento. */
export interface TiposDoFormulario {
  readonly leitura: CatalogoAcompanhado;
  readonly pendente: boolean;
  readonly opcoes: readonly TipoInstrumentoNormativoVocabularioDto[];
  readonly foraDasOpcoes: TipoForaDasOpcoes | null;
}

/**
 * Leitura do vocabulário de tipos de instrumento normativo: o rótulo de cada base na lista e as
 * opções do formulário. Cuida da leitura acompanhada (falha, nova tentativa e foco) e do tipo da
 * base em edição que o vocabulário não oferece.
 */
@Injectable()
export class TiposDeInstrumento {
  private readonly lista = inject(CatalogoDeTiposDeInstrumento).lista;
  private readonly motivo = motivoDaFalha(this.lista);
  private readonly tipoDaBaseEmEdicao = signal<string | null>(null);

  readonly pendente = this.lista.pendente;

  private readonly porCodigo = computed(
    () => new Map(this.lista.opcoes().map((tipo) => [tipo.codigo, tipo] as const)),
  );

  /** A frase que explica a falha, com o motivo da API na frente quando ele existe. */
  private readonly mensagemDaFalha = computed(() => {
    const explicacao =
      'A coluna Tipo mostra “Não carregado” e, sem o vocabulário de tipos, não é possível classificar a base legal.';
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

  /**
   * Sem uma option com o código da base em edição o select renderia em branco, mas o controle
   * continuaria com o código antigo, e salvar reenviaria um tipo que ninguém viu selecionado. A
   * opção segue o tipo original da base, e não o valor escolhido: trocar de tipo não a tira.
   */
  private readonly foraDasOpcoes = computed<TipoForaDasOpcoes | null>(() => {
    const codigo = this.tipoDaBaseEmEdicao();
    if (codigo === null || this.porCodigo().has(codigo)) {
      return null;
    }
    return { codigo, rotulo: this.pendente() ? 'Carregando…' : codigo };
  });

  readonly formulario = computed<TiposDoFormulario>(() => ({
    leitura: this.leitura,
    pendente: this.pendente(),
    opcoes: this.lista.opcoes(),
    foraDasOpcoes: this.foraDasOpcoes(),
  }));

  constructor() {
    this.lista.garantirCarregado();
  }

  /** Prepara a leitura para um formulário que abre: o tipo da base, se houver, e a lista. */
  preparar(tipoDaBase: string | null): void {
    this.tipoDaBaseEmEdicao.set(tipoDaBase);
    this.lista.garantirCarregado();
  }

  /** O rótulo do tipo na lista: nunca o código cru enquanto o vocabulário carrega ou falha. */
  resolver(codigo: string): ResolucaoDeVinculo {
    return resolverVinculo(this.lista, this.porCodigo().get(codigo), (tipo) => tipo.nome);
  }
}
