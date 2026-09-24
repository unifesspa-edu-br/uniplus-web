import { DestroyRef, Injectable, Signal, computed, inject } from '@angular/core';
import { type LookupCompleto, type ProblemDetails } from '@uniplus/shared-core/http';
import { GruposAreaEnemApi, type GrupoAreaEnemDto } from '@uniplus/shared-data/configuracao';

import { comRotuloExibivel } from '../codigo-e-rotulo';
import { nullIfBlank } from '../formulario';
import { listaDeReferencia } from '../lista-de-referencia';

/**
 * Vocabulário fechado de Grupo de área do ENEM, usado pelos cadastros de Cursos e de
 * Pesos por Área.
 *
 * Vive no injector raiz pelo mesmo motivo de `CatalogoTiposInstrumentoNormativo`:
 * dado de referência de baixo volume que não muda entre navegações — a instância
 * root evita repetir a requisição a cada tela que o usa.
 *
 * Carga, falha e nova tentativa seguem `listaDeReferencia`: o vocabulário sempre tem
 * grupos, e lista vazia é falha de carga.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoGruposAreaEnem implements LookupCompleto<GrupoAreaEnemDto> {
  private readonly api = inject(GruposAreaEnemApi);
  private readonly lista = listaDeReferencia<GrupoAreaEnemDto>(
    () => this.api.listar(),
    inject(DestroyRef),
    // Grupo sem código não tem o que gravar: não conta como item da lista.
    (grupo) => nullIfBlank(grupo.codigo) !== null,
  );

  readonly opcoes: Signal<readonly GrupoAreaEnemDto[]> = computed(() =>
    this.lista.opcoes().map(comRotuloExibivel),
  );
  readonly pendente: Signal<boolean> = this.lista.pendente;
  /** `true` quando a última tentativa não trouxe os grupos: recusada, com erro ou vazia. */
  readonly comErro: Signal<boolean> = this.lista.comErro;
  /** Se a tela deve mostrar o alerta de falha (ver `listaDeReferencia`). */
  readonly falhou: Signal<boolean> = this.lista.falhou;
  /** A recusa da API na última tentativa (ver `listaDeReferencia`). */
  readonly ultimoProblema: Signal<ProblemDetails | null> = this.lista.ultimoProblema;
  /** Falhas seguidas das tentativas do operador (ver `listaDeReferencia`). */
  readonly tentativasSemSucesso: Signal<number> = this.lista.tentativasSemSucesso;

  /** Índice por código — é por ele que cursos e pesos gravam o grupo. */
  readonly porCodigo = computed(
    () => new Map(this.opcoes().map((grupo) => [grupo.codigo, grupo] as const)),
  );

  /** O grupo como a tela o mostra, pela mesma regra das opções: quando o vocabulário tem
   *  o código, o texto dele (o rótulo oficial, ou o código); senão, o rótulo do próprio
   *  registro, ou o código. */
  exibivel(grupo: GrupoAreaEnemDto): GrupoAreaEnemDto {
    return this.porCodigo().get(grupo.codigo) ?? comRotuloExibivel(grupo);
  }

  garantirCarregado(): void {
    this.lista.garantirCarregado();
  }

  /** Recarga automática: descarta o que estiver em andamento e busca de novo, sem manter
   *  o alerta durante a tentativa. Para o "Tentar novamente" do operador, `tentarDeNovo`. */
  recarregar(): void {
    this.lista.recarregar();
  }

  /** Nova tentativa pedida pelo operador em "Tentar novamente": o alerta da falha
   *  anterior continua na tela até ela terminar. */
  tentarDeNovo(): void {
    this.lista.tentarDeNovo();
  }
}
