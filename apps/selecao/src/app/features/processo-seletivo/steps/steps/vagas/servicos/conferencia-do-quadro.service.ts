import { computed, inject, Injectable } from '@angular/core';

import { DistribuicaoDeVagas } from '../../../processo-seletivo.models';
import { regraPorChave } from '../../../shared/regra-por-chave';
import { CatalogosDeDistribuicaoService } from '../catalogos-de-distribuicao.service';
import {
  pendenciasDoQuadro,
  pendenciasQueImpedemGravar,
  voBaseInvalido,
} from '../conferencia-das-vagas';
import { EscopoDoProblema, ProblemaDaDistribuicao } from '../problema-da-distribuicao';
import { problemaDeVagasAutorizadas } from '../teto-e-soma-do-quadro';
import { ofertasRepetidas, problemasDaDistribuicao } from '../validacao-da-distribuicao';
import { EstadoDoPassoDeVagas } from './estado-do-passo-de-vagas';

/** O que a conferência diz do quadro: por que ele ainda não pode ser gravado. */
@Injectable()
export class ConferenciaDoQuadro {
  private readonly estado = inject(EstadoDoPassoDeVagas);
  private readonly catalogos = inject(CatalogosDeDistribuicaoService);

  /**
   * Problemas que vêm do padrão, e não de uma oferta em particular. Repetidos linha a linha, três
   * ofertas mostrariam três vezes o mesmo percentual em falta: o operador corrige num lugar só.
   */
  readonly problemasDoPadrao = computed<readonly string[]>(() => {
    const primeira = this.estado.distribuicoes()[0];
    return primeira === undefined ? [] : this.mensagensComEscopo(primeira, 'padrao');
  });

  readonly pendenciasDoQuadro = computed(() =>
    pendenciasDoQuadro(this.estado.distribuicoes(), this.estado.colunasDeQuantidade()),
  );

  /** O que impede de gravar o quadro: tudo aqui é erro a corrigir. */
  readonly pendenciasQueImpedemGravar = computed(() =>
    pendenciasQueImpedemGravar({
      numeroDeOpcoes: this.estado.numeroDeOpcoes(),
      distribuicoes: this.estado.distribuicoes(),
      ofertasForaDoPadrao: this.estado.ofertasForaDoPadrao().length,
      simulacaoCobreOQuadro: this.estado.simulacaoCobreOQuadro(),
      problemasDoPadrao: this.problemasDoPadrao(),
      pendenciasDoQuadro: this.pendenciasDoQuadro(),
      problemasEspecificos: this.problemasEspecificos(),
      ofertasRepetidas: ofertasRepetidas(this.estado.distribuicoes()),
      rotuloDaOferta: (id) => this.catalogos.rotuloDaOfertaOuSemNome(id),
    }),
  );

  /** O que destaca o campo do total: forma errada ou total acima do autorizado. */
  voBaseComProblema(distribuicao: DistribuicaoDeVagas): boolean {
    return voBaseInvalido(distribuicao) || this.problemaDeTeto(distribuicao) !== null;
  }

  problemasDe(distribuicao: DistribuicaoDeVagas): readonly ProblemaDaDistribuicao[] {
    const problemas = problemasDaDistribuicao(
      distribuicao,
      this.catalogos.modalidadePorId(),
      this.rolDaDistribuicao(distribuicao),
    );
    const teto = this.problemaDeTeto(distribuicao);
    return teto === null ? problemas : [...problemas, { escopo: 'oferta', mensagem: teto }];
  }

  /**
   * O que sobra depois do padrão e das pendências de preenchimento: recusas que valem para uma
   * oferta específica, como quantidade fixada numa modalidade que a regra calcula.
   */
  private problemasEspecificos(): readonly string[] {
    return this.estado
      .distribuicoes()
      .flatMap((distribuicao) =>
        this.mensagensComEscopo(distribuicao, 'oferta').map(
          (problema) =>
            `${this.catalogos.rotuloDaOfertaOuSemNome(distribuicao.ofertaCursoId)}: ${problema}`,
        ),
      );
  }

  /**
   * O rol da regra que ESTA oferta referencia, não necessariamente a do padrão: um processo
   * hidratado de fora do fluxo normal pode trazer uma oferta cuja regra já divergiu das demais.
   */
  private rolDaDistribuicao(distribuicao: DistribuicaoDeVagas): readonly string[] | null {
    const regra = regraPorChave(
      this.catalogos.regrasDistribuicao(),
      distribuicao.regraDistribuicaoCodigo,
      distribuicao.regraDistribuicaoVersao,
    );
    return regra?.modalidadesAdmitidas ?? null;
  }

  private mensagensComEscopo(
    distribuicao: DistribuicaoDeVagas,
    escopo: EscopoDoProblema,
  ): readonly string[] {
    return this.problemasDe(distribuicao)
      .filter((problema) => problema.escopo === escopo)
      .map((problema) => problema.mensagem);
  }

  private problemaDeTeto(distribuicao: DistribuicaoDeVagas): string | null {
    return problemaDeVagasAutorizadas(
      distribuicao.voBase,
      this.catalogos.vagasAutorizadasPorOferta().get(distribuicao.ofertaCursoId) ?? null,
    );
  }
}
