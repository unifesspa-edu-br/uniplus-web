import { Injectable, computed, inject, signal } from '@angular/core';
import { FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { deClausulasDoWire, fatosParaLeitura, resumoDaRegra } from '@uniplus/shared-ui/components';
import { lerCatalogoDeFatos } from './leituras-do-fato';
import { FatosCandidatoStore } from './fatos-candidato.store';
import { ID_DAS_REGRAS_DO_DETALHE } from './ids-do-fato';

type RegraPadrao = FatoCandidatoDto['regrasPadrao'][number];

/**
 * Leitura do fato aberto no detalhe. O fato vem da lista, e a releitura depois de uma escrita o
 * atualiza; o catálogo, que nomeia os fatos que as regras padrão citam, só é pedido quando o
 * fato aberto tem regra.
 */
@Injectable()
export class FatoDetalheStore {
  private readonly lista = inject(FatosCandidatoStore);

  readonly aberto = signal(false);
  private readonly id = signal<string | null>(null);

  readonly fato = computed(() => this.lista.fatoDe(this.id()));
  private readonly comRegras = computed(
    () => this.aberto() && (this.fato()?.regrasPadrao.length ?? 0) > 0,
  );
  private readonly catalogo = lerCatalogoDeFatos(() => this.comRegras(), {
    assunto: 'catálogo de fatos',
    consequencia: 'As regras aparecem com os códigos dos fatos.',
    destino: () => document.getElementById(ID_DAS_REGRAS_DO_DETALHE),
  });
  /** A falha do catálogo deixa as regras com os códigos no lugar dos nomes; a tela avisa e oferece nova tentativa. */
  readonly leituraDoCatalogo = this.catalogo.leitura;
  private readonly fatosNomeados = computed(() => {
    const catalogo = this.catalogo.itens();
    return catalogo.length === 0 ? null : fatosParaLeitura(catalogo);
  });

  /** As regras padrão em prosa: o valor que contribui e as condições, com os nomes do catálogo quando ele chegou. */
  readonly regrasEmProsa = computed(() => {
    const fato = this.fato();
    return fato === null
      ? []
      : fato.regrasPadrao.map((regra) => this.descricaoDaRegra(fato, regra));
  });

  abrir(fato: FatoCandidatoDto): void {
    this.id.set(fato.id);
    this.aberto.set(true);
  }

  fechar(): void {
    this.aberto.set(false);
  }

  private descricaoDaRegra(fato: FatoCandidatoDto, regra: RegraPadrao): string {
    const valor =
      regra.contribui === null
        ? null
        : (fato.valores.find((v) => v.codigo === regra.contribui)?.descricao ?? regra.contribui);
    const quando = resumoDaRegra(deClausulasDoWire(regra.quando), this.fatosNomeados());
    return `${valor === null ? 'É "sim"' : `Contribui "${valor}"`} quando: ${quando}`;
  }
}
