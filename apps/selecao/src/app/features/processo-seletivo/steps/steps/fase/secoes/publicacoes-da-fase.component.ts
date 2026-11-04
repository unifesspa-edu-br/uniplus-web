import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { PAPEL_PRELIMINAR, type ProdutoDaFase } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogosDoCronograma } from '../../cronograma/catalogos-do-cronograma.service';
import { PAPEIS_ESCOLHIVEIS } from '../configuracao-da-fase';
import { FaseEmEdicao } from '../fase-em-edicao';

/** As publicações que a fase declara, cada uma um tipo de ato do catálogo, com o papel que ela tem. */
@Component({
  selector: 'sel-publicacoes-da-fase',
  imports: [ValorLegivelDirective, FormsModule, ValorEmConsultaComponent],
  templateUrl: './publicacoes-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class PublicacoesDaFaseComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDoCronograma);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly espelho = this.faseEmEdicao.espelho;

  protected readonly idDaFase = this.faseEmEdicao.idDaFase;
  protected readonly erroDoCampo = this.faseEmEdicao.erroDoCampo;
  protected readonly papeis = PAPEIS_ESCOLHIVEIS;

  /** A leitura da consulta: cada publicação em texto, sem o controle que a edita. */
  protected faseLida() {
    if (this.espelho.formulario() === null) return null;
    const rotulos = this.catalogos.rotuloDoAto();
    const nomeDoAto = (codigo: string): string => rotulos.get(codigo) ?? codigo;
    const papel = (valor: string | null): string =>
      PAPEIS_ESCOLHIVEIS.find((opcao) => opcao.valor === (valor ?? ''))?.rotulo ?? valor ?? '';
    return {
      publicacoes: this.produtos.map(
        (produto) => `${nomeDoAto(produto.atoCodigo)} — ${papel(produto.papel)}`,
      ),
    };
  }

  /** Atos escolhíveis hoje, com a marca de resultado que decide o papel. */
  readonly atosEscolhiveis = computed(() =>
    this.catalogos
      .atosVigentes()
      .map((ato) => ({ codigo: ato.codigo, nome: ato.nome, ehResultado: ato.ehResultado })),
  );

  get produtos(): readonly ProdutoDaFase[] {
    this.espelho.versao();
    return this.espelho.formulario()?.controls.produtos.value ?? [];
  }

  acrescentarProduto(): void {
    this.escreverProdutos([...this.produtos, { atoCodigo: '', papel: null }]);
  }

  removerProduto(posicao: number): void {
    this.escreverProdutos(this.produtos.filter((_, indice) => indice !== posicao));
  }

  /**
   * Trocar o ato de uma publicação pode tirar dela o direito ao papel: só ato
   * que o catálogo marca como resultado o recebe. Zerar o papel junto evita
   * declarar uma combinação que a própria tela já sabe que o servidor recusa.
   */
  escolherAto(posicao: number, codigo: string): void {
    this.escreverProdutos(
      this.produtos.map((produto, indice) =>
        indice === posicao
          ? { atoCodigo: codigo, papel: this.aceitaPapel(codigo) ? produto.papel : null }
          : produto,
      ),
    );
  }

  escolherPapel(posicao: number, papel: string): void {
    this.escreverProdutos(
      this.produtos.map((produto, indice) =>
        indice === posicao ? { ...produto, papel: papel === '' ? null : papel } : produto,
      ),
    );
  }

  /**
   * Atos que o seletor desta linha oferece: os vigentes, mais o que ela já
   * declara quando esse saiu de vigência.
   *
   * Sem ele na lista, nenhuma opção casa e o campo aparece em branco — o
   * operador não veria qual publicação está declarada, e gravaria por cima dela
   * sem perceber.
   */
  atosPara(codigo: string): readonly { codigo: string; nome: string }[] {
    const vigentes = this.atosEscolhiveis();
    if (codigo === '' || vigentes.some((ato) => ato.codigo === codigo)) return vigentes;

    const nome = this.catalogos.rotuloDoAto().get(codigo);
    return [
      ...vigentes,
      { codigo, nome: nome === undefined ? codigo : `${nome} (fora de vigência)` },
    ];
  }

  /**
   * O ato desta linha aceita papel. Ato fora do catálogo carregado passa: quem
   * arbitra é o servidor, e travar o campo aqui esconderia o papel que a fase
   * já declara.
   */
  aceitaPapel(codigo: string): boolean {
    if (codigo === '') return false;
    const ato = this.faseEmEdicao.atoPorCodigo().get(codigo);
    return ato === undefined || ato.ehResultado;
  }

  /**
   * Escreve as publicações e reconcilia o que depende delas. A conclusão do ciclo recursal só
   * existe em fase que publica preliminar: deixar o código declarado para trás trancaria o passo
   * numa recusa cujo campo a tela já não mostra, sem caminho visível para desfazê-la.
   */
  private escreverProdutos(produtos: readonly ProdutoDaFase[]): void {
    const formulario = this.espelho.formulario();
    if (formulario === null) return;

    formulario.controls.produtos.setValue(produtos);

    const abreCicloRecursal = produtos.some((produto) => produto.papel === PAPEL_PRELIMINAR);
    if (!abreCicloRecursal && formulario.controls.faseConcluinteCodigo.value !== '') {
      formulario.controls.faseConcluinteCodigo.setValue('');
    }
  }
}
