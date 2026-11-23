import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  NormasDoDocumentoComponent,
  RecusaDoCampoComponent,
  type RecusaDoCampo,
  type TextosDasNormas,
} from '@uniplus/shared-ui/components';

import type { BaseLegalConfig } from '../../../processo-seletivo.models';
import { rotuloDaConsequencia } from '../resumo-da-exigencia';

@Component({
  selector: 'sel-consequencia-e-normas',
  imports: [NormasDoDocumentoComponent, RecusaDoCampoComponent],
  templateUrl: './consequencia-e-normas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsequenciaENormasComponent {
  readonly idDaConsequencia = input.required<string>();
  readonly idDasNormas = input.required<string>();
  readonly recusasDasNormas = input<readonly RecusaDoCampo[]>([]);
  readonly recusasDaConsequencia = input<readonly RecusaDoCampo[]>([]);
  readonly consequencia = input.required<string>();
  readonly bases = input.required<readonly BaseLegalConfig[]>();
  readonly opcoes =
    input.required<readonly { readonly valor: string; readonly rotulo: string }[]>();
  readonly obrigatorio = input(true);
  readonly desabilitado = input(false);
  readonly referenciaDaNorma = input('Norma que exige o documento');
  readonly consequenciaChange = output<string>();
  readonly basesChange = output<readonly BaseLegalConfig[]>();
  protected readonly rotuloDaConsequencia = rotuloDaConsequencia;
  protected readonly textos = computed<Partial<TextosDasNormas>>(() => ({
    referencia: this.referenciaDaNorma(),
    placeholderReferencia: 'Lei 12.711/2012, art. 3º',
    abrangencia: 'Alcance da norma',
    situacao: 'Identificação da norma',
    observacao: 'Observação',
    observacaoOculta: ' sobre a norma',
    observacaoSufixo: ' (opcional)',
    placeholderObservacao: 'O que esta norma exige, em uma linha',
    acrescentar: 'Acrescentar outra norma',
    remover: 'Remover esta norma',
    removerAcessivel: '',
  }));
}
