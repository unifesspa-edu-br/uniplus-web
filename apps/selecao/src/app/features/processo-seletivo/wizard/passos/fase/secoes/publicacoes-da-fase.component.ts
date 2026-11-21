import { FormularioDoCronograma } from '../../cronograma/servicos/formulario-do-cronograma.service';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ControlContainer, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import type { ProdutoDaFase } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogoDeAtos } from '../../cronograma/catalogos/catalogo-de-atos.service';
import { PAPEIS_ESCOLHIVEIS } from '../configuracao-da-fase';
import type { RecusaOrdenada } from '../../../shared/recusas/ordem-das-recusas';
import { RecusasDoCampoComponent } from '../../../shared/recusas/recusas-do-campo.component';
import { FaseEmEdicao } from '../fase-em-edicao';

/**
 * As publicações que a fase declara, cada uma um tipo de ato do catálogo, com o papel que ela tem,
 * e a promessa de parecer individual a cada candidato.
 */
@Component({
  selector: 'sel-publicacoes-da-fase',
  imports: [
    ValorLegivelDirective,
    FormsModule,
    ReactiveFormsModule,
    ValorEmConsultaComponent,
    RecusasDoCampoComponent,
  ],
  templateUrl: './publicacoes-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
  viewProviders: [
    { provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) },
  ],
})
export class PublicacoesDaFaseComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly cronograma = inject(FormularioDoCronograma);
  private readonly catalogoDeAtos = inject(CatalogoDeAtos);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly espelho = this.faseEmEdicao.espelho;

  protected readonly idDaFase = this.faseEmEdicao.idDaFase;
  protected readonly erroDoCampo = this.faseEmEdicao.erroDoCampo;
  protected readonly problemaLocal = this.faseEmEdicao.problemaLocal;
  protected readonly recusasDoCampo = this.faseEmEdicao.recusasDoCampo;
  protected readonly recusasDaLinha = this.faseEmEdicao.recusasDaLinha;
  protected readonly recusasDaLista = this.faseEmEdicao.recusasDaListaDePublicacoes;
  protected readonly temMensagemNaLista = this.faseEmEdicao.temMensagemNaListaDePublicacoes;
  protected readonly temMensagem = this.faseEmEdicao.temMensagem;
  protected readonly papeis = PAPEIS_ESCOLHIVEIS;
  protected readonly publicaPreliminar = this.faseEmEdicao.publicaPreliminar;
  protected readonly emiteParecerIndividual = computed(() => {
    this.espelho.versao();
    return this.espelho.formulario()?.controls.emiteParecerIndividual.value ?? false;
  });

  /** As recusas da linha inteira ou do ato dela, que a "Publicação" anuncia. */
  protected recusasDaPublicacao(posicao: number): readonly RecusaOrdenada[] {
    return this.recusasDaLinha(posicao).filter((recusa) => !this.ehDoPapel(recusa, posicao));
  }

  /** As recusas ao papel da linha, que só o "Papel" anuncia. */
  protected recusasDoPapel(posicao: number): readonly RecusaOrdenada[] {
    return this.recusasDaLinha(posicao).filter((recusa) => this.ehDoPapel(recusa, posicao));
  }

  /** A recusa à linha, ao ato dela ou à lista inteira marca a publicação como inválida. */
  protected publicacaoRecusada(posicao: number): boolean {
    return this.listaRecusada() || this.recusasDaPublicacao(posicao).length > 0;
  }

  /** A recusa ao papel da linha marca o papel como inválido. */
  protected papelRecusado(posicao: number): boolean {
    return this.recusasDoPapel(posicao).length > 0;
  }

  /** A lista inteira tem problema local ou recusa ainda vigente; a que será conferida de novo não conta. */
  private listaRecusada(): boolean {
    return (
      this.problemaLocal('produtos') !== null ||
      this.recusasDaLista().some((recusa) => !recusa.aConferir)
    );
  }

  private ehDoPapel(recusa: RecusaOrdenada, posicao: number): boolean {
    return recusa.campo === `produtos.${posicao}.papel`;
  }

  /** O que descreve a "Publicação" da linha: a recusa dela, a da lista, a ajuda e a orientação do definitivo. */
  protected idsQueDescrevemAPublicacao(posicao: number): string {
    const daLinha =
      this.recusasDaPublicacao(posicao).length > 0
        ? [this.idDaFase(`produto-${posicao}-publicacao-erro`)]
        : [];
    return this.comAAjudaDaLista(daLinha);
  }

  /** O que descreve o "Papel" da linha: a recusa dele, a da lista, a ajuda e a orientação do definitivo. */
  protected idsQueDescrevemOPapel(posicao: number): string {
    const doPapel =
      this.recusasDoPapel(posicao).length > 0
        ? [this.idDaFase(`produto-${posicao}-papel-erro`)]
        : [];
    return this.comAAjudaDaLista(doPapel);
  }

  private comAAjudaDaLista(daLinha: readonly string[]): string {
    const daLista = this.temMensagemNaLista() ? [this.idDaFase('produtos-erro')] : [];
    const orientacao = this.publicaPreliminar() ? [this.idDaFase('produtos-definitivo')] : [];
    return [...daLinha, ...daLista, this.idDaFase('produtos-ajuda'), ...orientacao].join(' ');
  }

  /** A leitura da consulta: cada publicação em texto, sem o controle que a edita. */
  protected faseLida() {
    if (this.espelho.formulario() === null) return null;
    const rotulos = this.catalogoDeAtos.rotuloDoAto();
    const nomeDoAto = (codigo: string): string => rotulos.get(codigo) ?? codigo;
    const papel = (valor: string | null): string =>
      PAPEIS_ESCOLHIVEIS.find((opcao) => opcao.valor === (valor ?? ''))?.rotulo ?? valor ?? '';
    return {
      publicacoes: this.produtos.map(
        (produto) => `${nomeDoAto(produto.atoCodigo)} — ${papel(produto.papel)}`,
      ),
      parecerIndividual: this.emiteParecerIndividual(),
    };
  }

  /** Atos escolhíveis hoje, com a marca de resultado que decide o papel. */
  readonly atosEscolhiveis = computed(() =>
    this.catalogoDeAtos
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

    const nome = this.catalogoDeAtos.rotuloDoAto().get(codigo);
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

  private escreverProdutos(produtos: readonly ProdutoDaFase[]): void {
    this.espelho.formulario()?.controls.produtos.setValue(produtos);
  }
}
