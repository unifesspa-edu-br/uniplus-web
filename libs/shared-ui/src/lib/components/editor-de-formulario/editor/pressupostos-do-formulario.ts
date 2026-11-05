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
import { pressupostosParaAcrescentar } from '../modelo/catalogo-de-campos';
import { FINALIDADE_INSCRICAO } from '../modelo/constantes';
import { type ContextoDoEditor } from '../modelo/contexto-do-editor';
import { acrescentarPressuposto, removerPressuposto } from '../modelo/pressupostos';
import { type ConteudoDoFormulario, type ResultadoDaEdicao } from '../modelo/tipos';

const SEM_FATO_QUE_CASE = 'Nenhum fato do candidato casa com o que você digitou.';

/**
 * Os fatos que o candidato já respondeu num formulário anterior: as regras do formulário os citam
 * como se tivessem sido respondidos antes de tudo. O modelo os declara fora da inscrição. O processo
 * não os tem — cita os fatos da inscrição —, e a seção só aparece nele se algum veio gravado, para
 * poder ser retirado.
 */
@Component({
  selector: 'ui-pressupostos-do-formulario',
  standalone: true,
  imports: [ComboboxComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../anfitriao.css',
  template: `
    @if (aparece()) {
      <section class="editor-formulario__etapa" [attr.aria-labelledby]="idBase() + '-pressupostos'">
        <h3 class="editor-formulario__titulo-etapa" [id]="idBase() + '-pressupostos'">
          Fatos pressupostos
        </h3>
        <p class="field__hint">
          Fatos que o candidato já respondeu num formulário anterior, como o de inscrição. As regras
          deste formulário podem citá-los como se tivessem sido respondidos antes de tudo.
        </p>
        @if (pressupostos().length > 0) {
          <ul class="editor-formulario__basicos">
            @for (fato of pressupostos(); track fato) {
              <li>
                {{ nomeDoFato(fato) }}
                <button
                  class="btn btn--tertiary btn--sm"
                  type="button"
                  [disabled]="contexto().disabled"
                  [attr.aria-label]="'Retirar o pressuposto ' + nomeDoFato(fato)"
                  (click)="retirar(fato)"
                >
                  Retirar
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="field__hint">Nenhum fato pressuposto.</p>
        }
        <div class="editor-formulario__acrescentar">
          <div class="field">
            <label class="field__label" [attr.for]="campo.campoId">Fato a pressupor</label>
            <ui-combobox
              #campo
              [id]="idBase() + '-pressuposto'"
              rotulo="Fatos do candidato"
              placeholder="Escolha o fato do candidato"
              [textoSemResultado]="semFatoQueCase"
              [contagemVisivel]="false"
              [grupos]="grupos()"
              [value]="escolha()"
              [disabled]="contexto().disabled || possiveis().length === 0"
              (valueChange)="escolhido.set($event)"
            />
          </div>
          <button
            class="btn btn--secondary btn--sm"
            type="button"
            [disabled]="contexto().disabled || escolha() === ''"
            (click)="acrescentar()"
          >
            <i class="pi pi-plus" aria-hidden="true"></i> Acrescentar pressuposto
          </button>
        </div>
      </section>
    }
  `,
})
export class PressupostosDoFormularioComponent {
  private readonly injector = inject(Injector);

  readonly contexto = input.required<ContextoDoEditor>();

  readonly conteudoChange = output<ConteudoDoFormulario>();
  readonly anuncio = output<string>();

  protected readonly semFatoQueCase = SEM_FATO_QUE_CASE;
  protected readonly escolhido = signal('');

  protected readonly idBase = computed(() => this.contexto().idBase);
  protected readonly pressupostos = computed(() => this.contexto().conteudo.pressupostos ?? []);
  protected readonly aparece = computed(() => {
    const { fatosDaInscricao, finalidade } = this.contexto();
    const gravados = this.pressupostos().length > 0;
    return fatosDaInscricao === null ? finalidade !== FINALIDADE_INSCRICAO || gravados : gravados;
  });
  /** No processo não se acrescenta pressuposto: a seção, quando aparece, só retira o que veio gravado. */
  protected readonly possiveis = computed(() => {
    const { conteudo, catalogo, finalidade, fatosDaInscricao } = this.contexto();
    return fatosDaInscricao === null
      ? pressupostosParaAcrescentar(conteudo, catalogo, finalidade)
      : [];
  });
  protected readonly grupos = computed(() => fatosEmGrupo(this.possiveis()));
  protected readonly escolha = computed(() =>
    this.possiveis().some((fato) => fato.codigo === this.escolhido()) ? this.escolhido() : '',
  );

  protected nomeDoFato(codigo: string): string {
    return this.contexto().nomes.get(codigo) ?? codigo;
  }

  protected acrescentar(): void {
    const fato = this.escolha();
    if (fato === '') return;
    this.conteudoChange.emit(acrescentarPressuposto(this.contexto().conteudo, fato));
    this.escolhido.set('');
    this.anuncio.emit(`“${this.nomeDoFato(fato)}” passa a ser pressuposto.`);
    this.devolverOFoco();
  }

  protected retirar(fato: string): void {
    aplicarEdicao(this.resultadoDaRetirada(fato), this, () => {
      this.anuncio.emit(`“${this.nomeDoFato(fato)}” deixou de ser pressuposto.`);
      this.devolverOFoco();
    });
  }

  /** No processo, o fato que a inscrição coleta continua conhecido sem o pressuposto: as regras que o citam seguem válidas. */
  private resultadoDaRetirada(fato: string): ResultadoDaEdicao {
    const { conteudo, fatosDaInscricao, nomes } = this.contexto();
    if (!(fatosDaInscricao ?? []).includes(fato)) return removerPressuposto(conteudo, fato, nomes);
    const pressupostos = (conteudo.pressupostos ?? []).filter((p) => p !== fato);
    return { ok: true, conteudo: { ...conteudo, pressupostos } };
  }

  /** Sem o combo, que some quando a seção some ou fica sem opção, o foco volta ao título do formulário. */
  private devolverOFoco(): void {
    focarDepois(this.injector, `${this.idBase()}-pressuposto`, `${this.idBase()}-titulo`);
  }
}
