import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import type { BancaRequeridaDaFase } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogosDoCronogramaService } from '../../cronograma/catalogos-do-cronograma.service';
import { FaseEmEdicao } from '../fase-em-edicao';

/** As bancas que a fase requer, com o recorte de categorias de documento que cada uma julga. */
@Component({
  selector: 'sel-bancas-da-fase',
  imports: [ValorLegivelDirective, FormsModule, ValorEmConsultaComponent],
  templateUrl: './bancas-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class BancasDaFaseComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  private readonly catalogos = inject(CatalogosDoCronogramaService);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly espelho = this.faseEmEdicao.espelho;

  protected readonly idDaFase = this.faseEmEdicao.idDaFase;
  protected readonly erroDoCampo = this.faseEmEdicao.erroDoCampo;
  protected readonly bancasEscolhiveis = this.faseEmEdicao.bancasEscolhiveis;

  /** Categorias de documento do cadastro, na ordem de exibição que ele decide. */
  protected readonly categorias = computed(() =>
    this.catalogos.categorias().map((categoria) => ({ id: categoria.id, nome: categoria.nome })),
  );

  /** A leitura da consulta: cada banca em texto, com o recorte que julga. */
  protected faseLida() {
    if (this.espelho.formulario() === null) return null;
    const categorias = this.categorias();
    return {
      bancas: this.bancas.map((banca) => {
        const nomes = banca.categoriasDocumentoIds.map(
          (id) => categorias.find((categoria) => categoria.id === id)?.nome ?? id,
        );
        const nomeDaBanca = this.faseEmEdicao.nomeDaBanca(banca.tipoBancaId);
        return nomes.length === 0 ? nomeDaBanca : `${nomeDaBanca} — julga ${nomes.join(', ')}`;
      }),
    };
  }

  // ─── Bancas requeridas e o recorte de competência ───────────────────────

  get bancas(): readonly BancaRequeridaDaFase[] {
    this.espelho.versao();
    return this.espelho.formulario()?.controls.bancasRequeridas.value ?? [];
  }

  acrescentarBanca(): void {
    this.escreverBancas([...this.bancas, { tipoBancaId: '', categoriasDocumentoIds: [] }]);
  }

  removerBanca(posicao: number): void {
    this.escreverBancas(this.bancas.filter((_, indice) => indice !== posicao));
  }

  escolherTipoDeBanca(posicao: number, tipoBancaId: string): void {
    this.escreverBancas(
      this.bancas.map((banca, indice) => (indice === posicao ? { ...banca, tipoBancaId } : banca)),
    );
  }

  alternarCategoria(posicao: number, categoriaId: string, marcada: boolean): void {
    this.escreverBancas(
      this.bancas.map((banca, indice) => {
        if (indice !== posicao) return banca;
        const semEla = banca.categoriasDocumentoIds.filter((id) => id !== categoriaId);
        return { ...banca, categoriasDocumentoIds: marcada ? [...semEla, categoriaId] : semEla };
      }),
    );
  }

  categoriaMarcada(posicao: number, categoriaId: string): boolean {
    return this.bancas[posicao]?.categoriasDocumentoIds.includes(categoriaId) === true;
  }

  /**
   * A banca desta linha divide o tipo com outra da mesma fase — é o caso em que
   * o recorte deixa de ser opcional, porque é ele que diz qual julga o quê.
   */
  recorteObrigatorio(posicao: number): boolean {
    const tipo = this.bancas[posicao]?.tipoBancaId;
    if (tipo === undefined || tipo === '') return false;
    return this.bancas.filter((banca) => banca.tipoBancaId === tipo).length > 1;
  }

  private escreverBancas(bancas: readonly BancaRequeridaDaFase[]): void {
    this.espelho.formulario()?.controls.bancasRequeridas.setValue(bancas);
  }
}
