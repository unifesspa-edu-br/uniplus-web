import {
  camposDaMudanca,
  camposNaParte,
  type CamposEditadosDoFormulario,
} from './modelo/campos-editados';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';

import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import { type CondicaoEmClausula } from '../editor-de-condicoes/condicoes/condicoes-em-clausulas';
import { type FatoEscolhivel } from '../editor-de-condicoes/condicoes/fatos-escolhiveis';
import { LIMITES_DO_FORMULARIO } from './modelo/constantes';
import {
  type ApresentacaoDaPagina,
  type PaginaDoFormulario,
  type PredicadoNoWire,
} from './modelo/tipos';
import {
  paraPredicado,
  problemasDasCondicoes,
  recopiarSeMudouPorFora,
} from './predicado-em-edicao';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

/**
 * O que a seção diz ao candidato — título, descrição e aviso — e quando ela aparece. Devolve a
 * página inteira a cada mudança; os itens da seção são do editor.
 */
@Component({
  selector: 'insc-secao-do-formulario',
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
          [value]="pagina().apresentacao.titulo"
          [maxLength]="limites.tituloDaPagina"
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
          [value]="pagina().apresentacao.descricao ?? ''"
          [maxLength]="limites.textoDaPagina"
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
          [value]="pagina().apresentacao.aviso ?? ''"
          [maxLength]="limites.textoDaPagina"
          [disabled]="disabled()"
          [attr.aria-describedby]="idDe('aviso-nota')"
          (input)="trocar({ aviso: textoOuNulo($event) })"
        ></textarea>
        <span class="field__hint" [id]="idDe('aviso-nota')"
          >Destacado no topo da seção, para o que o candidato não pode deixar de ler.</span
        >
      </div>
    </div>

    <insc-editor-de-condicoes
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
  readonly pagina = input.required<PaginaDoFormulario>();
  /** Os fatos que a exibição da seção pode citar. */
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);

  readonly camposEditados = output<CamposEditadosDoFormulario>();
  readonly paginaChange = output<PaginaDoFormulario>();

  protected readonly limites = LIMITES_DO_FORMULARIO;
  protected readonly tituloVazio = computed(() => this.pagina().apresentacao.titulo.trim() === '');

  protected readonly condicoes = linkedSignal<PredicadoNoWire, readonly CondicaoEmClausula[]>({
    source: () => this.pagina().exibicao ?? null,
    computation: recopiarSeMudouPorFora,
  });

  protected readonly problemas = computed(() =>
    problemasDasCondicoes(this.condicoes(), this.fatos()),
  );

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

  protected trocar(mudanca: Partial<ApresentacaoDaPagina>): void {
    this.camposEditados.emit(camposNaParte(['apresentacao'], camposDaMudanca(mudanca)));
    const apresentacao = { ...this.pagina().apresentacao, ...mudanca };
    this.paginaChange.emit({ ...this.pagina(), apresentacao });
  }

  protected trocarExibicao(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoes.set(condicoes);
    this.camposEditados.emit([['exibicao']]);
    this.paginaChange.emit({ ...this.pagina(), exibicao: paraPredicado(condicoes) });
  }
}
