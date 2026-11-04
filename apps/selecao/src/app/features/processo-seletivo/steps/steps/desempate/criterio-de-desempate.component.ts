import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { CondicaoDeFatoComponent, ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import type { CriterioDesempateConfigurado, EtapaPontuada } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  alcanceDaCondicao,
  comparaComLista,
  operadoresDoFato,
  RESPOSTAS_BOOLEANAS,
  valorEscalarDe,
  valoresDeListaDe,
  type CondicaoDeFato,
  type FatoEscolhivel,
} from '../../shared/gatilho-de-exigencia';
import { leituraDoCampoDecimal } from '../../shared/numero-do-campo';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { regrasEscolhiveis, rotuloDaRegraEscolhida } from '../classificacao/regra-escolhivel';
import { AreasDoDesempate } from './areas-do-desempate.service';
import {
  desempateTemShapeConhecido,
  desempateUsaAreas,
  desempateUsaEtapa,
  desempateUsaIdadeMinima,
  desempateUsaPredicadoFato,
} from './desempate-para-comando';
import { OrdemDasAreasComponent, type MovimentoDeArea } from './ordem-das-areas.component';

/**
 * Um critério de desempate: a regra e os campos que ela usa — a etapa, a idade mínima, o fato do
 * candidato com a comparação, ou a ordem das áreas do ENEM —, com os botões que o sobem, descem e
 * removem. Em consulta, o critério como o processo o gravou.
 *
 * Quem altera a lista é o passo: o componente emite o que o operador pediu.
 */
@Component({
  selector: 'sel-criterio-de-desempate',
  imports: [ValorEmConsultaComponent, CondicaoDeFatoComponent, OrdemDasAreasComponent],
  templateUrl: './criterio-de-desempate.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [':host { display: block; }'],
})
export class CriterioDeDesempateComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly catalogos = inject(CatalogosDeClassificacaoService);
  protected readonly areas = inject(AreasDoDesempate);

  readonly indice = input.required<number>();
  readonly criterio = input.required<CriterioDesempateConfigurado>();
  readonly ultimo = input.required<boolean>();
  /** As etapas já persistidas do cronograma, que um critério pode citar. */
  readonly etapas = input.required<readonly EtapaPontuada[]>();
  /** O vocabulário de fatos do candidato que um critério pode citar. */
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  /** O catálogo de fatos foi lido: só então se pode dizer que um fato saiu dele. */
  readonly fatosLidos = input.required<boolean>();
  /** A área escolhida no seletor da ordem das áreas e ainda não incluída. */
  readonly escolhaDeArea = input('');

  readonly alterar = output<Partial<CriterioDesempateConfigurado>>();
  readonly regraEscolhida = output<string>();
  readonly mover = output<number>();
  readonly remover = output();
  readonly areaEscolhida = output<string>();
  readonly areaAcrescentada = output();
  readonly areaRemovida = output<number>();
  readonly areaMovida = output<MovimentoDeArea>();

  protected readonly usaEtapa = computed(() => desempateUsaEtapa(this.criterio().regraCodigo));
  protected readonly usaIdadeMinima = computed(() =>
    desempateUsaIdadeMinima(this.criterio().regraCodigo),
  );
  protected readonly usaPredicadoFato = computed(() =>
    desempateUsaPredicadoFato(this.criterio().regraCodigo),
  );
  protected readonly usaAreas = computed(() => desempateUsaAreas(this.criterio().regraCodigo));

  /**
   * As regras que o seletor oferece: as do catálogo cujos argumentos esta tela sabe montar, mais a
   * que já está escolhida — mesmo desconhecida, ela precisa continuar visível, senão o critério
   * gravado aparece sem regra nenhuma.
   */
  protected readonly opcoesDaRegra = computed(() =>
    regrasEscolhiveis(
      this.catalogos
        .criteriosDesempate()
        .filter(
          (regra) =>
            desempateTemShapeConhecido(regra.codigo) ||
            regra.codigo === this.criterio().regraCodigo,
        ),
      this.criterio().regraCodigo,
      this.criterio().regraVersao,
    ),
  );

  private readonly fato = computed(() =>
    this.fatos().find((candidato) => candidato.codigo === this.criterio().fato),
  );

  /** O que o predicado alcança — a mesma leitura que a exigência documental oferece. */
  protected readonly alcance = computed(() => {
    const fato = this.fato();
    return fato === undefined ? '' : alcanceDaCondicao(this.criterio(), fato);
  });

  /** O critério como se lê em consulta, com o rótulo de cada escolha. */
  protected readonly leituraDoCriterio = computed(() => {
    const criterio = this.criterio();
    const etapa = this.etapas().find((item) => item.id === criterio.etapaRef);
    return {
      regra: rotuloDaRegraEscolhida(this.opcoesDaRegra()),
      etapa: etapa === undefined ? null : etapa.nome || 'Etapa sem nome',
      idadeMinima: leituraDoCampoDecimal(criterio.idadeMinima),
      fato: this.rotuloDoFato(criterio),
      comparacao: this.rotuloDaComparacao(criterio),
      ...this.leituraDoValor(criterio),
      areas: criterio.areas.map((codigo) => this.areas.rotuloDaArea(codigo)),
    };
  });

  private rotuloDoFato(criterio: CriterioDesempateConfigurado): string | null {
    const nome = this.fato()?.nome;
    if (nome !== undefined) return nome;
    if (criterio.fato === '') return null;
    return this.fatosLidos() ? `${criterio.fato} — fora do catálogo` : criterio.fato;
  }

  private rotuloDaComparacao(criterio: CriterioDesempateConfigurado): string | null {
    const fato = this.fato();
    const comparacao = (fato === undefined ? [] : operadoresDoFato(fato)).find(
      (opcao) => opcao.valor === criterio.operador,
    );
    return comparacao?.rotulo ?? (criterio.operador || null);
  }

  private leituraDoValor(criterio: CriterioDesempateConfigurado) {
    if (comparaComLista(criterio.operador)) {
      return { rotuloDoValor: 'Valores', valor: valoresDeListaDe(criterio) };
    }
    const escalar = valorEscalarDe(criterio);
    if (this.fato()?.tipoDominio === 'BOOLEANO') {
      const resposta = RESPOSTAS_BOOLEANAS.find((opcao) => opcao.valor === escalar);
      return { rotuloDoValor: 'Resposta', valor: resposta?.rotulo ?? escalar };
    }
    return { rotuloDoValor: 'Valor', valor: escalar };
  }

  /** A condição que o componente devolve: só os três campos do predicado entram no critério. */
  protected alterarCondicao(condicao: CondicaoDeFato): void {
    this.alterar.emit({ fato: condicao.fato, operador: condicao.operador, valor: condicao.valor });
  }
}
