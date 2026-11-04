import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import type { RegraEliminacaoConfigurada } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import {
  eliminacaoUsaAreaEMinimo,
  eliminacaoUsaEtapa,
  eliminacaoUsaEtapaENotaMinima,
} from '../classificacao/classificacao-para-comando';
import { GravacaoDaClassificacaoService } from '../classificacao/gravacao-da-classificacao.service';
import { regrasEscolhiveis } from '../classificacao/regra-escolhivel';
import type { CampoDaRegra } from './recusas-da-eliminacao';
import {
  areasEscolhiveis,
  corteSugerido,
  etapasEscolhiveis,
  rotuloDoMinimo,
  trocaDeArea,
  trocaDeRegra,
  type EtapaReferenciavel,
  type QuadroDoCorte,
} from './regras-de-eliminacao';

/**
 * Uma regra de eliminação em edição: a escolha da regra e os campos que ela usa — a etapa e a nota
 * mínima, ou a área do ENEM e o corte. Trocar de regra apaga o que a nova não usa, e a recusa do
 * servidor a um campo fica junto dele até a regra mudar.
 */
@Component({
  selector: 'sel-regra-de-eliminacao',
  templateUrl: './regra-de-eliminacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host { display: block; }'],
})
export class RegraDeEliminacaoComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDeClassificacaoService);
  private readonly gravacao = inject(GravacaoDaClassificacaoService);

  /** A posição da regra na lista, que também compõe os ids dos campos. */
  readonly indice = input.required<number>();
  /** As etapas já persistidas do cronograma, que a regra pode citar. */
  readonly etapas = input.required<readonly EtapaReferenciavel[]>();
  /** O quadro dos cortes por área, contra o qual o servidor confere o corte. */
  readonly quadro = input.required<QuadroDoCorte>();
  /** O operador pediu para remover a regra. */
  readonly remover = output();

  private readonly regras = computed(() => this.store.draft().classificacao.regrasEliminacao);
  protected readonly regra = computed(() => this.regras()[this.indice()]);

  protected readonly usaEtapa = computed(() => eliminacaoUsaEtapa(this.regra().regraCodigo));
  protected readonly usaEtapaENotaMinima = computed(() =>
    eliminacaoUsaEtapaENotaMinima(this.regra().regraCodigo),
  );
  protected readonly usaAreaEMinimo = computed(() =>
    eliminacaoUsaAreaEMinimo(this.regra().regraCodigo),
  );

  protected readonly opcoesDaRegra = computed(() =>
    regrasEscolhiveis(
      this.catalogos.regrasEliminacao(),
      this.regra().regraCodigo,
      this.regra().regraVersao,
    ),
  );
  protected readonly etapasEscolhiveis = computed(() =>
    etapasEscolhiveis(this.regras(), this.etapas(), this.indice()),
  );
  protected readonly areasEscolhiveis = computed(() =>
    areasEscolhiveis(this.regras(), this.quadro(), this.indice()),
  );
  protected readonly corteSugerido = computed(() => corteSugerido(this.regra(), this.quadro()));
  protected readonly rotuloDoMinimo = computed(() => rotuloDoMinimo(this.regra(), this.quadro()));

  protected recusaDoCampo(campo: CampoDaRegra): string | null {
    return this.gravacao.recusaDoCampo(this.indice(), campo);
  }

  /** O `aria-describedby` do campo: a recusa, quando há, e a dica, quando há. */
  protected descritoPor(campo: CampoDaRegra, dica: string | null): string | null {
    const ids = [
      this.recusaDoCampo(campo) === null ? null : `elim-${campo}-erro-${this.indice()}`,
      dica,
    ].filter((id): id is string => id !== null);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected escolherRegra(chave: string): void {
    this.atualizar(trocaDeRegra(chave));
  }

  protected escolherArea(areaCodigo: string): void {
    this.atualizar(trocaDeArea(this.regra(), areaCodigo, this.quadro()));
  }

  protected alterarEtapaRef(etapaRef: string): void {
    this.atualizar({ etapaRef });
  }

  protected alterarNotaMinima(notaMinima: string): void {
    this.atualizar({ notaMinima });
  }

  protected alterarMinimo(minimo: string): void {
    this.atualizar({ minimo });
  }

  private atualizar(patch: Partial<RegraEliminacaoConfigurada>): void {
    this.gravacao.esquecerRecusasDa(this.indice());
    this.store.patchObjectSection('classificacao', {
      regrasEliminacao: this.regras().map((regra, item) =>
        item === this.indice() ? { ...regra, ...patch } : regra,
      ),
    });
  }
}
