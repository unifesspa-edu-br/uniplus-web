import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { explicarRegra } from '../../../shared/regra-explicada/regra-em-linguagem-clara';
import { RegraExplicadaComponent } from '../../../shared/regra-explicada/regra-explicada.component';
import { regraPorChave } from '../../../shared/regra-por-chave';
import { CatalogosDeDistribuicaoService } from '../catalogos-de-distribuicao.service';
import { padraoAposTrocarDeRegra } from '../edicao-do-padrao';
import { EstadoDoPassoDeVagas } from '../servicos/estado-do-passo-de-vagas';

export const AVISO_DA_TROCA_DE_REGRA =
  'Trocar a regra de distribuição substitui as modalidades desta oferta pelas que a nova regra admite, e pode remover do quadro quantidades já preenchidas — de modalidade que sai da seleção, ou de modalidade que fica mas cuja quantidade a nova regra não aceita mais como declarada. O processo só muda quando o passo for gravado.';

/** A regra de distribuição de vagas do edital e o que ela passa a exigir do resto do formulário. */
@Component({
  selector: 'sel-regra-da-distribuicao',
  imports: [ValorLegivelDirective, ValorEmConsultaComponent, FormsModule, RegraExplicadaComponent],
  templateUrl: './regra-da-distribuicao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class RegraDaDistribuicaoComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly catalogos = inject(CatalogosDeDistribuicaoService);
  protected readonly estado = inject(EstadoDoPassoDeVagas);

  /**
   * O `<select>` de regra, só para o cancelamento: `NgModel` só reescreve o `<select>` nativo
   * quando o valor do binding muda, e entre a interação do operador e o cancelamento o modelo
   * interno já ficou sincronizado com a escolha rejeitada. Corrige-se escrevendo o `value` nativo.
   */
  private readonly campoDeRegra = viewChild<ElementRef<HTMLSelectElement>>('campoRegra');

  /**
   * O valor que o `<select>` exibe: a escolha pendente enquanto ela aguarda confirmação, o padrão
   * vigente fora disso. Ligar `[ngModel]` direto ao padrão faria cancelar a troca não voltar a
   * tela, porque o padrão nunca muda ao cancelar; este computed muda em cada transição.
   */
  protected readonly valorDoSelectDeRegra = computed(() => {
    const pendente = this.estado.trocaDeRegraPendente();
    const padrao = this.estado.padrao();
    return pendente !== null
      ? `${pendente.codigo}|${pendente.versao}`
      : `${padrao.regraDistribuicaoCodigo}|${padrao.regraDistribuicaoVersao}`;
  });

  /** O que a regra escolhida estabelece. Sem isto, o operador escolhe entre dois códigos às cegas. */
  protected readonly regraExplicada = computed(() =>
    explicarRegra(this.estado.regraDistribuicaoEscolhida()),
  );

  /** O que a regra escolhida passa a exigir do resto do formulário. */
  protected readonly exigenciasDaRegra = computed<readonly string[]>(() =>
    this.estado.ehFederal()
      ? [
          'referência de reserva demográfica',
          'regra de ajuste (art. 11, § único)',
          'as oito modalidades federais e a ampla concorrência',
        ]
      : ['a quantidade de vagas de cada modalidade, fixada pelo edital'],
  );

  protected escolher(valor: string): void {
    const [codigo = '', versao = ''] = valor.split('|');
    const padrao = this.estado.padrao();
    if (codigo === padrao.regraDistribuicaoCodigo && versao === padrao.regraDistribuicaoVersao) {
      return;
    }

    // `padrao.modalidades` cobre a seleção mesmo antes da primeira oferta existir: checar só as
    // ofertas deixaria passar sem aviso a troca que descarta modalidades já escolhidas.
    const haDadoAPerder =
      padrao.modalidades.length > 0 ||
      this.estado.distribuicoes().some((item) => item.quadro.length > 0);
    if (haDadoAPerder) {
      this.estado.trocaDeRegraPendente.set({ codigo, versao });
      return;
    }
    this.aplicar(codigo, versao);
  }

  confirmarTroca(): void {
    const pendente = this.estado.trocaDeRegraPendente();
    if (pendente === null) return;

    this.estado.trocaDeRegraPendente.set(null);
    this.aplicar(pendente.codigo, pendente.versao);
  }

  cancelarTroca(): void {
    this.estado.trocaDeRegraPendente.set(null);

    const elemento = this.campoDeRegra()?.nativeElement;
    if (elemento) elemento.value = this.valorDoSelectDeRegra();
  }

  private aplicar(codigo: string, versao: string): void {
    const rol =
      regraPorChave(this.catalogos.regrasDistribuicao(), codigo, versao)?.modalidadesAdmitidas ??
      null;

    this.estado.alterarPadrao(
      padraoAposTrocarDeRegra(this.estado.padrao(), {
        codigo,
        versao,
        rol,
        catalogo: this.catalogos.modalidades(),
      }),
    );
  }
}
