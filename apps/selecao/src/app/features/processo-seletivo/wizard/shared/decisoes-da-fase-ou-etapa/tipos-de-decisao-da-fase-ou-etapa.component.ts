import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';
import {
  opcoesDoVocabulario,
  VOCABULARIO_DE_TIPOS_DE_DECISAO,
} from '@uniplus/shared-data/configuracao';
import {
  acompanharLeitura,
  FalhaDeLeituraDoCampoComponent,
  IndicadorDaLeituraDirective,
} from '@uniplus/shared-ui/components';

import { comTipoDeclarado, semTipoDeclarado } from './tipos-de-decisao-declarados';

/**
 * Os tipos de decisão que uma fase ou uma etapa toma, como grupo de caixas de marcar ligado ao
 * formulário por `formControlName`. O valor é a lista de códigos declarados, em ordem alfabética.
 */
@Component({
  selector: 'sel-tipos-de-decisao-da-fase-ou-etapa',
  imports: [FalhaDeLeituraDoCampoComponent, IndicadorDaLeituraDirective],
  templateUrl: './tipos-de-decisao-da-fase-ou-etapa.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .opcoes {
      display: flex;
      flex-direction: column;
    }
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TiposDeDecisaoDaFaseOuEtapaComponent),
      multi: true,
    },
  ],
})
export class TiposDeDecisaoDaFaseOuEtapaComponent implements ControlValueAccessor {
  readonly idDoGrupo = input.required<string>();
  readonly legenda = input.required<string>();

  protected readonly vocabulario = inject(VOCABULARIO_DE_TIPOS_DE_DECISAO);
  private readonly anfitriao = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly declarados = signal<readonly string[]>([]);
  protected readonly desabilitado = signal(false);
  protected readonly opcoes = computed(() =>
    opcoesDoVocabulario(
      this.vocabulario.itens(),
      this.declarados().map((codigo) => ({ codigo, rotulo: 'Tipo de decisão não identificado' })),
    ),
  );
  protected readonly leitura = acompanharLeitura({
    falha: this.vocabulario.erro,
    pendente: this.vocabulario.carregando,
    recarregar: () => this.vocabulario.recarregar(),
    destino: () =>
      this.anfitriao.nativeElement.querySelector<HTMLElement>('input[type="checkbox"]'),
    assunto: 'os tipos de decisão',
  });

  private avisarAlteracao: (declarados: readonly string[]) => void = () => undefined;
  private avisarToque: () => void = () => undefined;

  protected estaDeclarado(codigo: string): boolean {
    return this.declarados().includes(codigo);
  }

  protected alternar(codigo: string, marcado: boolean): void {
    const atuais = this.declarados();
    const novos = marcado ? comTipoDeclarado(atuais, codigo) : semTipoDeclarado(atuais, codigo);
    this.declarados.set(novos);
    this.avisarAlteracao(novos);
    this.avisarToque();
  }

  writeValue(declarados: readonly string[] | null): void {
    this.declarados.set(declarados ?? []);
  }

  registerOnChange(fn: (declarados: readonly string[]) => void): void {
    this.avisarAlteracao = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.avisarToque = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitado.set(desabilitado);
  }
}
