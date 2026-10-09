import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';

import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import { type CondicaoEmClausula, type FatoEscolhivel } from '../editor-de-condicoes/condicoes-de-fatos';
import { LIMITES_DO_FORMULARIO, type EtapaDoFormulario, type PredicadoNoWire } from './formulario-editavel';
import { paraPredicado, problemasDasCondicoes, recopiarSeMudouPorFora } from './predicado-em-edicao';
import { ValorLegivelDirective } from '../valor-legivel/valor-legivel.directive';

/**
 * O que a seção diz ao candidato — título, descrição e aviso — e quando ela aparece. Devolve a
 * etapa inteira a cada mudança; os itens da seção são do editor.
 */
@Component({
  selector: 'ui-secao-do-formulario',
  standalone: true,
  imports: [ValorLegivelDirective, EditorDeCondicoesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-grid">
      <div class="field" [class.is-error]="tituloVazio()">
        <label class="field__label is-required" [for]="idDe('titulo')">Título da seção</label>
        <input
          class="input"
          type="text"
          [id]="idDe('titulo')"
          [value]="etapa().titulo"
          [maxLength]="limites.tituloDaEtapa"
          [disabled]="disabled()"
          [attr.aria-invalid]="tituloVazio() ? 'true' : null"
          [attr.aria-describedby]="tituloVazio() ? idDe('titulo-erro') : null"
          (input)="trocar({ titulo: valorDe($event) })"
        />
        @if (tituloVazio()) {
          <span class="field__error" [id]="idDe('titulo-erro')">A seção precisa de título.</span>
        }
      </div>

      <div class="field form-grid__full">
        <label class="field__label" [for]="idDe('descricao')">Descrição</label>
        <textarea
          class="textarea"
          rows="2"
          [id]="idDe('descricao')"
          [value]="etapa().descricao ?? ''"
          [maxLength]="limites.textoDaEtapa"
          [disabled]="disabled()"
          (input)="trocar({ descricao: textoOuNulo($event) })"
        ></textarea>
      </div>

      <div class="field form-grid__full">
        <label class="field__label" [for]="idDe('aviso')">Aviso</label>
        <textarea
          class="textarea"
          rows="2"
          [id]="idDe('aviso')"
          [value]="etapa().aviso ?? ''"
          [maxLength]="limites.textoDaEtapa"
          [disabled]="disabled()"
          [attr.aria-describedby]="idDe('aviso-nota')"
          (input)="trocar({ aviso: textoOuNulo($event) })"
        ></textarea>
        <span class="field__hint" [id]="idDe('aviso-nota')">Destacado no topo da seção, para o que o candidato não pode deixar de ler.</span>
      </div>
    </div>

    <ui-editor-de-condicoes
      legenda="Exibir a seção só quando"
      textoSemCondicao="A seção é exibida sempre."
      textoSemFatos="Nenhum campo anterior pode ser citado: a exibição da seção cita só campos de seções anteriores."
      [condicoes]="condicoes()"
      [fatos]="fatos()"
      [idBase]="idDe('exibicao')"
      [disabled]="disabled()"
      [erros]="problemas()"
      (condicoesChange)="trocarExibicao($event)"
    />
  `,
})
export class SecaoDoFormularioComponent {
  readonly etapa = input.required<EtapaDoFormulario>();
  /** Os fatos que a exibição da seção pode citar. */
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);

  readonly etapaChange = output<EtapaDoFormulario>();

  protected readonly limites = LIMITES_DO_FORMULARIO;
  protected readonly tituloVazio = computed(() => this.etapa().titulo.trim() === '');

  protected readonly condicoes = linkedSignal<PredicadoNoWire, readonly CondicaoEmClausula[]>({
    source: () => this.etapa().exibicao ?? null,
    computation: recopiarSeMudouPorFora,
  });

  protected readonly problemas = computed(() => problemasDasCondicoes(this.condicoes(), this.fatos()));

  protected idDe(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected textoOuNulo(evento: Event): string | null {
    const valor = this.valorDe(evento);
    return valor.trim() === '' ? null : valor;
  }

  protected trocar(mudanca: Partial<EtapaDoFormulario>): void {
    this.etapaChange.emit({ ...this.etapa(), ...mudanca });
  }

  protected trocarExibicao(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoes.set(condicoes);
    this.trocar({ exibicao: paraPredicado(condicoes) });
  }
}
