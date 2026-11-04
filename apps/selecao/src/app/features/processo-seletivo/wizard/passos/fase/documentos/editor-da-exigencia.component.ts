import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import {
  ComboboxComponent,
  EditorDeCondicoesComponent,
  ValorLegivelDirective,
} from '@uniplus/shared-ui/components';
import { consequenciasDaFase } from '@uniplus/shared-utils';

import type { BaseLegalConfig, ModeloDaExigencia } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { descreverFase } from '../../../shared/descricao-da-fase';
import {
  ABRANGENCIAS_ESCOLHIVEIS,
  CONSEQUENCIAS_ESCOLHIVEIS,
  FATO_MODALIDADE,
  STATUS_BASE_LEGAL_ESCOLHIVEIS,
  baseLegalNova,
} from '../../../shared/exigencias/exigencias-documentais';
import { mostraFormulario } from '../../../shared/exigencias/formulario-da-exigencia';
import { CatalogoDeFases } from '../../cronograma/catalogos/catalogo-de-fases.service';
import { FaseEmEdicao } from '../fase-em-edicao';
import { ModeloDaExigenciaComponent } from '../modelo-da-exigencia/modelo-da-exigencia.component';
import { rotuloDaConsequencia } from '../resumo-da-exigencia';
import type { ResumoDoDocumento } from '../tipos-da-conferencia';
import { EixoAlcanceComponent } from './eixos/eixo-alcance.component';
import { EixoEtapaComponent } from './eixos/eixo-etapa.component';
import { EixoFormularioComponent } from './eixos/eixo-formulario.component';
import { EixoRepeticaoComponent } from './eixos/eixo-repeticao.component';
import { ExigenciasDaFaseStore } from './exigencias-da-fase.store';
import { GatilhoDasExigenciasStore } from './gatilho-das-exigencias.store';

/** A exigência de um documento na fase aberta: os campos que o operador edita. */
@Component({
  selector: 'sel-editor-da-exigencia',
  imports: [
    ValorLegivelDirective,
    ComboboxComponent,
    EditorDeCondicoesComponent,
    EixoAlcanceComponent,
    EixoEtapaComponent,
    EixoFormularioComponent,
    EixoRepeticaoComponent,
    ModeloDaExigenciaComponent,
  ],
  templateUrl: './editor-da-exigencia.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
  host: { class: 'doc-item doc-item--exigido' },
})
export class EditorDaExigenciaComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly exigencias = inject(ExigenciasDaFaseStore);
  protected readonly gatilho = inject(GatilhoDasExigenciasStore);
  private readonly catalogoDeFases = inject(CatalogoDeFases);
  private readonly faseEmEdicao = inject(FaseEmEdicao);

  readonly resumo = input.required<ResumoDoDocumento>();
  readonly remover = output<void>();

  protected readonly idDaFase = this.faseEmEdicao.idDaFase;

  /**
   * O que a tela oferece como consequência NESTA fase.
   *
   * "Abre pendência para reenvio" só é aceita em fase que admite complementação — quem decide
   * é o cadastro da fase canônica, não este passo. Oferecê-la onde a fase não admite produzia
   * uma recusa na gravação que o operador não sabia ligar ao que fez, e sem remédio à mão: o
   * sinalizador não é editável aqui.
   */
  consequenciasDaFase(): readonly { readonly valor: string; readonly rotulo: string }[] {
    return consequenciasDaFase(CONSEQUENCIAS_ESCOLHIVEIS, this.faseAdmiteComplementacao());
  }

  /** Se a fase aberta admite reenvio de documento depois da análise. */
  faseAdmiteComplementacao(): boolean {
    const fase = this.faseEmEdicao.faseDoRascunho();
    if (fase === null) return false;
    return descreverFase(fase, this.catalogoDeFases.fasePorId()).permiteComplementacao;
  }

  readonly consequencias = CONSEQUENCIAS_ESCOLHIVEIS;

  readonly abrangencias = ABRANGENCIAS_ESCOLHIVEIS;

  readonly statusBaseLegal = STATUS_BASE_LEGAL_ESCOLHIVEIS;

  ehObrigatorio(id: string): boolean {
    return this.exigencias.exigenciaDoDocumento(id).obrigatorio;
  }

  /**
   * Exigência obrigatória decide sozinha o resultado da análise — e é por isso que a publicação
   * cobra a norma dela. A facultativa segue sem norma declarada.
   */
  escolherObrigatoriedade(id: string, valor: string): void {
    this.exigencias.escreverExigencia(id, { obrigatorio: valor === 'sim' });
  }

  /** O modelo que a exigência oferece ao candidato nesta fase; `null` quando não oferece. */
  modeloDoDocumento(id: string): ModeloDaExigencia | null {
    return this.exigencias.exigenciaDoDocumento(id).modelo;
  }

  /** Vincula o modelo confirmado à exigência desta fase, ou o desvincula com `null`. */
  definirModelo(id: string, modelo: ModeloDaExigencia | null): void {
    this.exigencias.escreverExigencia(id, { modelo });
  }

  consequenciaDoDocumento(id: string): string {
    return this.exigencias.exigenciaDoDocumento(id).consequenciaIndeferimento;
  }

  /**
   * A consequência é o que faz a exigência decidir sozinha o resultado. Quem declara uma
   * consequência está dizendo que ela decide, e a publicação vai cobrar a norma.
   */
  escolherConsequencia(id: string, consequencia: string): void {
    this.exigencias.escreverExigencia(id, { consequenciaIndeferimento: consequencia });
  }

  /** As normas que sustentam a exigência nesta fase — são N por exigência (ADR-0074). */
  basesLegaisDoDocumento(id: string): readonly BaseLegalConfig[] {
    return this.exigencias.exigenciaDoDocumento(id).basesLegais;
  }

  /** Escreve um campo de UMA das normas, endereçada pela posição. */
  escreverBaseLegal(
    id: string,
    posicao: number,
    campo: keyof BaseLegalConfig,
    valor: string,
  ): void {
    const bases = this.basesLegaisDoDocumento(id).map((base, i) =>
      i === posicao ? { ...base, [campo]: valor } : base,
    );
    this.exigencias.escreverExigencia(id, { basesLegais: bases });
  }

  /** Acrescenta uma norma à exigência — uma lei federal somada à cláusula do edital. */
  acrescentarBaseLegal(id: string): void {
    this.exigencias.escreverExigencia(id, {
      basesLegais: [...this.basesLegaisDoDocumento(id), baseLegalNova()],
    });
  }

  /**
   * Remove uma norma. A última não sai: a exigência que decide o resultado precisa de norma
   * resolvida para publicar, e deixar a lista vazia tiraria da tela o campo que a publicação
   * cobra — a linha em branco não viaja no comando de qualquer forma.
   */
  removerBaseLegal(id: string, posicao: number): void {
    const bases = this.basesLegaisDoDocumento(id);
    if (bases.length <= 1) return;
    this.exigencias.escreverExigencia(id, { basesLegais: bases.filter((_, i) => i !== posicao) });
  }

  /** O rótulo da consequência, o mesmo no seletor do editor e no resumo. */
  rotuloDaConsequencia(valor: string, obrigatorio: boolean): string {
    return rotuloDaConsequencia(valor, obrigatorio);
  }

  /** O fato que tem controle próprio ao lado do gatilho: o editor não o mostra. */
  readonly fatoDoRecorte = FATO_MODALIDADE;

  /**
   * Se a escolha do formulário aparece: na fase que responde algum, e em qualquer fase enquanto o
   * formulário declarado não é respondido nela — escondê-la deixaria a falta sem o campo que a resolve.
   */
  mostraFormulario(id: string): boolean {
    return mostraFormulario(
      this.exigencias.exigenciaDoDocumento(id).finalidade,
      this.exigencias.finalidadesDaFaseAberta(),
    );
  }
}
