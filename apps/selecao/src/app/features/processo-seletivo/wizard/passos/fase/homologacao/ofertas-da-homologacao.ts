import { computed, inject, Injectable } from '@angular/core';
import {
  fatosEscolhiveis,
  fatosParaLeitura,
  type FatoEscolhivel,
} from '@uniplus/shared-inscricao/formulario';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogoDeAtos } from '../../cronograma/catalogos/catalogo-de-atos.service';
import { CatalogoDeFatos } from '../../cronograma/catalogos/catalogo-de-fatos.service';
import { FATO_DA_EDICAO_DO_ENEM } from '../../classificacao/edicoes-do-enem';
import { GatilhoDasExigenciasStore } from '../documentos/gatilho-das-exigencias.store';
import { MotivosDaFaseStore } from '../motivos/motivos-da-fase.store';

/**
 * O que as listas da regra de homologação oferecem, lido do que o processo declara: as edições do
 * exame da Fórmula, os motivos desfavoráveis que a fase escolheu e os fatos do enquadramento.
 * Cada passo da fase tem a sua instância.
 */
@Injectable()
export class OfertasDaHomologacao {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogoDeAtos = inject(CatalogoDeAtos);
  private readonly catalogoDeFatos = inject(CatalogoDeFatos);
  private readonly gatilho = inject(GatilhoDasExigenciasStore);
  private readonly motivos = inject(MotivosDaFaseStore);

  /** As edições do exame que o processo declara no passo Fórmula, em texto, na ordem declarada. */
  readonly edicoesDeclaradas = computed(() => this.store.draft().classificacao.edicoesEnem);

  /** Os motivos desfavoráveis que a fase escolheu para a homologação das inscrições. */
  readonly motivosDesfavoraveis = this.motivos.desfavoraveisDaHomologacao;

  /** O nome de cada ato; o ato fora do catálogo aparece pelo código. */
  readonly nomeDoAto = computed(() => {
    const nomes = this.catalogoDeAtos.rotuloDoAto();
    return (codigo: string): string => nomes.get(codigo) ?? codigo;
  });

  /** Os fatos que o enquadramento pode citar, com as edições do exame como valores da edição. */
  readonly fatosDoEnquadramento = computed<readonly FatoEscolhivel[]>(() =>
    fatosEscolhiveis(
      this.catalogoDeFatos.fatos(),
      new Map([
        ...this.gatilho.dominiosDoGatilho(),
        [FATO_DA_EDICAO_DO_ENEM, this.edicoesDeclaradas()],
      ]),
    ),
  );

  /** Todo fato do catálogo pelo código, para ler a regra gravada mesmo quando cita fato que o editor não oferece. */
  readonly fatosParaLeitura = computed(() => fatosParaLeitura(this.catalogoDeFatos.fatos()));
}
