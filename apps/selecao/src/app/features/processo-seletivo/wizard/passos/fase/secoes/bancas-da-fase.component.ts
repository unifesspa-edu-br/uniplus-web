import type { BancaDeclarada } from '../../../modelos/banca.models';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';
import type {
  BancaRequeridaDaFase,
  RegraDeDeliberacaoDaBanca,
} from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { ListaDeBancasComponent } from '../../../shared/bancas/lista-de-bancas.component';
import { identificacaoDaBanca } from '../../../shared/bancas/lista-de-bancas';
import { descricaoDaRegra } from '../../../shared/deliberacao/descricao-da-regra';
import {
  errosDaBancaPorCampo,
  recusasDaBancaPorCampo,
  type RecusasDaBancaPorCampo,
} from '../../../shared/deliberacao/recusas-da-regra';
import { RegraDeDeliberacaoComponent } from '../../../shared/deliberacao/regra-de-deliberacao.component';
import { RecusasDoCampoComponent } from '../../../shared/recusas/recusas-do-campo.component';
import { CatalogoDeBancas } from '../../cronograma/catalogos/catalogo-de-bancas.service';
import { CatalogoDeDocumentos } from '../../cronograma/catalogos/catalogo-de-documentos.service';
import { FormularioDoCronograma } from '../../cronograma/servicos/formulario-do-cronograma.service';
import { FaseEmEdicao } from '../fase-em-edicao';

@Component({
  selector: 'sel-bancas-da-fase',
  imports: [
    ListaDeBancasComponent,
    RecusasDoCampoComponent,
    ValorEmConsultaComponent,
    RegraDeDeliberacaoComponent,
  ],
  templateUrl: './bancas-da-fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class BancasDaFaseComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly cronograma = inject(FormularioDoCronograma);
  private readonly catalogoDeDocumentos = inject(CatalogoDeDocumentos);
  private readonly catalogoDeBancas = inject(CatalogoDeBancas);
  private readonly faseEmEdicao = inject(FaseEmEdicao);
  private readonly espelho = this.faseEmEdicao.espelho;
  protected readonly idDaFase = this.faseEmEdicao.idDaFase;
  protected readonly problemaLocal = this.faseEmEdicao.problemaLocal;
  protected readonly recusasDaLista = this.faseEmEdicao.recusasDaListaDeBancas;
  protected readonly categorias = computed(() => this.catalogoDeDocumentos.categorias());
  protected readonly tipos = computed(() =>
    this.catalogoDeBancas.bancas().map((tipo) => ({
      ...tipo,
      rotulo: tipo.codigo.rotulo,
    })),
  );

  protected faseLida() {
    if (this.espelho.formulario() === null) return null;
    return { bancas: this.bancas.map((banca) => this.descreverBanca(banca)) };
  }

  private descreverBanca(banca: BancaRequeridaDaFase): string {
    const nomes = banca.categoriasDocumentoIds.map(
      (id) => this.categorias().find((categoria) => categoria.id === id)?.nome ?? id,
    );
    const nome = identificacaoDaBanca(this.bancas, banca, '');
    const candidatos = nomes.length === 0 ? nome : `${nome} — julga ${nomes.join(', ')}`;
    return `${candidatos} — ${descricaoDaRegra(banca.regraDeDeliberacao)}`;
  }

  get bancas(): readonly BancaRequeridaDaFase[] {
    this.espelho.versao();
    return this.espelho.formulario()?.controls.bancasRequeridas.value ?? [];
  }

  protected escreverBancas(bancas: readonly BancaDeclarada[]): void {
    const anteriores = new Map(this.bancas.map((banca) => [banca.identificadorLocal, banca]));
    this.espelho.formulario()?.controls.bancasRequeridas.setValue(
      bancas.map((banca) => ({
        ...banca,
        categoriasDocumentoIds:
          anteriores.get(banca.identificadorLocal)?.categoriasDocumentoIds ?? [],
      })),
    );
  }

  /** O que a conferência local recusa na regra de cada banca, pelo identificador da banca. */
  protected readonly errosDasRegras = computed(
    () =>
      new Map(
        this.bancas.map((banca, posicao) => [banca.identificadorLocal, this.errosDaRegra(posicao)]),
      ),
  );

  /** As recusas do servidor à regra de cada banca que ainda valem, pela posição dela na lista. */
  protected readonly recusasDasRegras = computed(
    () =>
      new Map(
        this.bancas.map((banca, posicao) => [
          banca.identificadorLocal,
          this.recusasDaRegra(posicao),
        ]),
      ),
  );

  private errosDaRegra(posicao: number) {
    return errosDaBancaPorCampo((campo) =>
      this.faseEmEdicao.problemaLocal(`bancasRequeridas.${posicao}.${campo}`),
    );
  }

  private recusasDaRegra(posicao: number): RecusasDaBancaPorCampo {
    return recusasDaBancaPorCampo((campo) =>
      this.faseEmEdicao
        .recusasDoCampo(`bancasRequeridas.${posicao}.${campo}`)
        .filter((recusa) => !recusa.aConferir),
    );
  }

  protected declararRegra(banca: BancaDeclarada, regra: RegraDeDeliberacaoDaBanca | null): void {
    this.escreverBancas(
      this.bancas.map((atual) =>
        atual.identificadorLocal === banca.identificadorLocal
          ? { ...atual, regraDeDeliberacao: regra }
          : atual,
      ),
    );
  }

  protected alternarCategoria(banca: BancaDeclarada, categoriaId: string, marcada: boolean): void {
    const bancas = this.bancas.map((atual) => {
      if (atual.identificadorLocal !== banca.identificadorLocal) return atual;
      const semEla = atual.categoriasDocumentoIds.filter((id) => id !== categoriaId);
      return { ...atual, categoriasDocumentoIds: marcada ? [...semEla, categoriaId] : semEla };
    });
    this.espelho.formulario()?.controls.bancasRequeridas.setValue(bancas);
  }

  protected categoriaMarcada(banca: BancaDeclarada, categoriaId: string): boolean {
    return (
      this.bancas
        .find((atual) => atual.identificadorLocal === banca.identificadorLocal)
        ?.categoriasDocumentoIds.includes(categoriaId) === true
    );
  }
}
