import { Injectable, computed, inject, signal } from '@angular/core';
import {
  acompanharNovaTentativa,
  type FaseDaNovaTentativa,
  destinoAcessivel,
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
  readonly falhou: boolean;
  readonly pendente: boolean;
  readonly fase: FaseDaNovaTentativa;
  readonly opcoes: readonly TipoInstrumentoNormativoVocabularioDto[];
  readonly mensagemDeFalha: string;
  readonly foraDasOpcoes: TipoForaDasOpcoes | null;
}

/**
 * Leitura do vocabulário de tipos de instrumento normativo: o rótulo de cada base na lista e as
 * opções do formulário. Cuida da falha, da nova tentativa com foco e do tipo da base em edição
 * que o vocabulário não oferece.
 */
@Injectable()
export class TiposDeInstrumento {
  private readonly lista = inject(CatalogoDeTiposDeInstrumento).lista;
  private readonly motivo = motivoDaFalha(this.lista);
  private readonly tipoDaBaseEmEdicao = signal<string | null>(null);

  readonly falhou = this.lista.falhou;
  readonly pendente = this.lista.pendente;

  private readonly porCodigo = computed(
    () => new Map(this.lista.opcoes().map((tipo) => [tipo.codigo, tipo] as const)),
  );

  /** A frase que explica a falha, com o motivo da API na frente quando ele existe. */
  private frase(complemento: string): string {
    const motivo = nullIfBlank(this.motivo());
    return motivo ? `${comPontoFinal(motivo)} ${complemento}` : complemento;
  }

  readonly mensagemNaPagina = computed(() =>
    this.frase('A coluna Tipo mostra “Não carregado” até a busca ser refeita.'),
  );

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
    falhou: this.falhou(),
    pendente: this.pendente(),
    fase: this.novaTentativa.fase(),
    opcoes: this.lista.opcoes(),
    mensagemDeFalha: this.frase(
      'Sem o vocabulário de tipos não é possível classificar a base legal.',
    ),
    foraDasOpcoes: this.foraDasOpcoes(),
  }));

  /** O alerta da página e o do formulário (um drawer) dividem a leitura: uma só tentativa, uma só fase. */
  readonly novaTentativa = acompanharNovaTentativa({
    assunto: 'tipos de instrumento',
    pendente: this.pendente,
    falhou: this.falhou,
    destino: () =>
      destinoAcessivel(
        document.getElementById('cfg-blbr-tipo'),
        document.getElementById('cfg-base-legal-list-title'),
      ),
  });

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

  tentarDeNovo(): void {
    this.novaTentativa.executar(() => this.lista.tentarDeNovo());
  }
}
