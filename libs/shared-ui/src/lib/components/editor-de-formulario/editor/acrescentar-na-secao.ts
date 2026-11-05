import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ComboboxComponent } from '../../combobox/combobox';
import { aplicarEdicao } from '../edicao';
import { fatosEmGrupo } from '../fatos-em-grupo';
import { focarDepois } from '../foco';
import { idDaEtapa, idDoGrupo, idDoItem } from '../ids';
import { type ContextoDoEditor } from '../modelo/contexto-do-editor';
import { LIMITES_DO_FORMULARIO } from '../modelo/constantes';
import { acrescentarGrupo } from '../modelo/grupos';
import { acrescentarCampo } from '../modelo/itens';
import { type ConteudoDoFormulario, type EtapaDoFormulario } from '../modelo/tipos';

const SEM_FATO_QUE_CASE = 'Nenhum fato do candidato casa com o que você digitou.';

/** O acréscimo de um campo ou de um grupo repetível ao fim de uma seção. */
@Component({
  selector: 'ui-acrescentar-na-secao',
  standalone: true,
  imports: [ComboboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../anfitriao.css',
  template: `
    <div class="editor-formulario__acrescentar">
      <div class="field">
        <label class="field__label" [attr.for]="campo.campoId">Campo a acrescentar</label>
        <ui-combobox
          #campo
          [id]="idDaSecao() + '-acrescentar'"
          rotulo="Fatos do candidato"
          placeholder="Escolha o fato do candidato"
          [textoSemResultado]="semFatoQueCase"
          [contagemVisivel]="false"
          [grupos]="grupos()"
          [value]="escolha()"
          [disabled]="contexto().disabled || contexto().noTeto || paraAcrescentar().length === 0"
          [descritoPor]="contexto().noTeto ? contexto().idBase + '-teto' : null"
          (valueChange)="fatoEscolhido.set($event)"
        />
      </div>
      <button
        class="btn btn--secondary btn--sm"
        type="button"
        [disabled]="contexto().disabled || contexto().noTeto || escolha() === ''"
        (click)="acrescentarOItem()"
      >
        <i class="pi pi-plus" aria-hidden="true"></i> Acrescentar campo
      </button>
    </div>

    @if (contexto().fatosDeMembro.length > 0) {
      <div class="editor-formulario__acrescentar">
        <div class="field">
          <label class="field__label" [for]="idDaSecao() + '-grupo-rotulo'"
            >Rótulo do grupo repetível</label
          >
          <input
            class="input"
            type="text"
            [id]="idDaSecao() + '-grupo-rotulo'"
            [value]="rotuloDoGrupo()"
            [maxLength]="limites.rotulo"
            [disabled]="contexto().disabled"
            (input)="rotuloDoGrupo.set(valorDe($event))"
          />
        </div>
        <div class="field">
          <label class="field__label" [for]="idDaSecao() + '-grupo-campo'"
            >Primeiro campo de cada ocorrência</label
          >
          <select
            class="select"
            [id]="idDaSecao() + '-grupo-campo'"
            [disabled]="contexto().disabled"
            (change)="membroEscolhido.set(valorDe($event))"
          >
            <option value="" [selected]="membro() === ''">Escolha o fato do membro</option>
            @for (fato of contexto().fatosDeMembro; track fato.codigo) {
              <option [value]="fato.codigo" [selected]="membro() === fato.codigo">
                {{ fato.nome }}
              </option>
            }
          </select>
        </div>
        <button
          class="btn btn--secondary btn--sm"
          type="button"
          [disabled]="contexto().disabled || rotuloDoGrupo().trim() === '' || membro() === ''"
          (click)="acrescentarOGrupo()"
        >
          <i class="pi pi-plus" aria-hidden="true"></i> Acrescentar grupo repetível
        </button>
      </div>
    }
  `,
})
export class AcrescentarNaSecaoComponent {
  private readonly injector = inject(Injector);

  readonly contexto = input.required<ContextoDoEditor>();
  readonly etapa = input.required<EtapaDoFormulario>();

  readonly conteudoChange = output<ConteudoDoFormulario>();
  readonly anuncio = output<string>();

  protected readonly limites = LIMITES_DO_FORMULARIO;
  protected readonly semFatoQueCase = SEM_FATO_QUE_CASE;

  protected readonly fatoEscolhido = signal('');
  protected readonly rotuloDoGrupo = signal('');
  protected readonly membroEscolhido = signal('');

  protected readonly idDaSecao = computed(() =>
    idDaEtapa(this.contexto().idBase, this.etapa().codigo),
  );
  protected readonly paraAcrescentar = computed(() => this.contexto().paraAcrescentar);
  protected readonly grupos = computed(() => fatosEmGrupo(this.paraAcrescentar()));
  /** O fato escolhido, enquanto ainda pode ser acrescentado — outra seção pode tê-lo levado. */
  protected readonly escolha = computed(() =>
    this.paraAcrescentar().some((fato) => fato.codigo === this.fatoEscolhido())
      ? this.fatoEscolhido()
      : '',
  );
  /** O fato de membro escolhido para o grupo novo, enquanto ainda pode ser usado. */
  protected readonly membro = computed(() =>
    this.contexto().fatosDeMembro.some((fato) => fato.codigo === this.membroEscolhido())
      ? this.membroEscolhido()
      : '',
  );

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected acrescentarOItem(): void {
    const { conteudo, catalogo, conteudoParaCitacoes } = this.contexto();
    const fato = this.paraAcrescentar().find((f) => f.codigo === this.escolha());
    if (fato === undefined) return;
    const citacoes = { catalogo, fatosConhecidosAntes: conteudoParaCitacoes.pressupostos ?? [] };
    aplicarEdicao(acrescentarCampo(conteudo, fato, this.etapa().codigo, citacoes), this, () => {
      this.fatoEscolhido.set('');
      this.anuncio.emit(`Campo “${fato.nome}” acrescentado ao fim de ${this.etapa().titulo}.`);
      focarDepois(this.injector, `${idDoItem(this.contexto().idBase, fato.codigo)}-rotulo`);
    });
  }

  protected acrescentarOGrupo(): void {
    const { conteudo, catalogo, fatosDeMembro } = this.contexto();
    const rotulo = this.rotuloDoGrupo();
    const primeiroCampo = fatosDeMembro.find((f) => f.codigo === this.membro());
    if (primeiroCampo === undefined) return;
    const novo = { rotulo, etapaCodigo: this.etapa().codigo, primeiroCampo };
    aplicarEdicao(acrescentarGrupo(conteudo, novo, catalogo), this, (editado) => {
      const grupo = (editado.grupos ?? []).find(
        (g) => !(conteudo.grupos ?? []).some((anterior) => anterior.codigo === g.codigo),
      );
      this.rotuloDoGrupo.set('');
      this.membroEscolhido.set('');
      this.anuncio.emit(
        `Grupo repetível “${rotulo.trim()}” acrescentado ao fim de ${this.etapa().titulo}.`,
      );
      if (grupo !== undefined) {
        focarDepois(this.injector, `${idDoGrupo(this.contexto().idBase, grupo.codigo)}-rotulo`);
      }
    });
  }
}
