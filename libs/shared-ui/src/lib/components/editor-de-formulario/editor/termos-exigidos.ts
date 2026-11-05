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

import { focarDepois } from '../foco';
import { idDoTermo } from '../ids';
import { type ContextoDoEditor } from '../modelo/contexto-do-editor';
import {
  acrescentarTermo,
  comTermo,
  moverTermo,
  removerTermo,
  termosEmOrdem,
  termosParaAcrescentar,
} from '../modelo/termos';
import { type ConteudoDoFormulario, type TermoDisponivel } from '../modelo/tipos';
import { TermoDoFormularioComponent } from '../termo-do-formulario';

/**
 * Os termos de consentimento que o formulário exige, aceitos na revisão e aceite: a lista, a
 * versão de cada um e o acréscimo de termo. Só termos com versão promovida podem ser exigidos.
 */
@Component({
  selector: 'ui-termos-exigidos',
  standalone: true,
  imports: [TermoDoFormularioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../anfitriao.css',
  template: `
    <h4 class="editor-formulario__titulo-item">Termos de consentimento exigidos</h4>
    @if (termos().length > 0) {
      <ol class="editor-formulario__itens" aria-label="Termos exigidos">
        @for (termo of termos(); track termo.codigo; let posicao = $index) {
          <li>
            <ui-termo-do-formulario
              [termo]="termo"
              [disponivel]="termoDisponivel(termo.termoId)"
              [posicao]="posicao + 1"
              [fatos]="contexto().fatosDosTermos"
              [idBase]="idDoTermo(idBase(), termo.codigo)"
              [podeSubir]="posicao > 0"
              [podeDescer]="posicao < termos().length - 1"
              [disabled]="contexto().disabled"
              [erros]="contexto().recusas?.porTermo?.get(termo.codigo) ?? []"
              (termoChange)="conteudoChange.emit(comTermo(contexto().conteudo, $event))"
              (mover)="mover(termo.codigo, $event)"
              (remover)="remover(termo.codigo)"
            />
          </li>
        }
      </ol>
    } @else {
      <p class="field__hint">Nenhum termo exigido.</p>
    }
    <div class="editor-formulario__acrescentar">
      <div class="field">
        <label class="field__label" [for]="idBase() + '-termo'">Termo a exigir</label>
        <select
          class="select"
          [id]="idBase() + '-termo'"
          [disabled]="contexto().disabled || possiveis().length === 0"
          [attr.aria-describedby]="idBase() + '-termo-nota'"
          (change)="escolhido.set(valorDe($event))"
        >
          <option value="" [selected]="escolha() === ''">Escolha o termo de consentimento</option>
          @for (termo of possiveis(); track termo.termoId) {
            <option [value]="termo.termoId" [selected]="escolha() === termo.termoId">
              {{ termo.nome }}
            </option>
          }
        </select>
      </div>
      <button
        class="btn btn--secondary btn--sm"
        type="button"
        [disabled]="contexto().disabled || escolha() === ''"
        (click)="acrescentar()"
      >
        <i class="pi pi-plus" aria-hidden="true"></i> Exigir termo
      </button>
    </div>
    <span class="field__hint" [id]="idBase() + '-termo-nota'"
      >Só termos com versão promovida podem ser exigidos.</span
    >
  `,
})
export class TermosExigidosComponent {
  private readonly injector = inject(Injector);

  readonly contexto = input.required<ContextoDoEditor>();

  readonly conteudoChange = output<ConteudoDoFormulario>();
  readonly anuncio = output<string>();

  protected readonly idDoTermo = idDoTermo;
  protected readonly comTermo = comTermo;
  protected readonly escolhido = signal('');

  protected readonly idBase = computed(() => this.contexto().idBase);
  protected readonly termos = computed(() => termosEmOrdem(this.contexto().conteudo));
  protected readonly possiveis = computed(() =>
    termosParaAcrescentar(this.contexto().conteudo, this.contexto().termosDisponiveis),
  );
  protected readonly escolha = computed(() =>
    this.possiveis().some((termo) => termo.termoId === this.escolhido()) ? this.escolhido() : '',
  );

  protected termoDisponivel(termoId: string): TermoDisponivel | undefined {
    return this.contexto().termosDisponiveis.find((termo) => termo.termoId === termoId);
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLSelectElement).value;
  }

  private nomeDoTermo(termoId: string | undefined, codigo: string): string {
    return this.termoDisponivel(termoId ?? '')?.nome ?? codigo;
  }

  protected acrescentar(): void {
    const termo = this.possiveis().find((t) => t.termoId === this.escolha());
    if (termo === undefined) return;
    const conteudo = acrescentarTermo(this.contexto().conteudo, termo);
    this.conteudoChange.emit(conteudo);
    this.escolhido.set('');
    this.anuncio.emit(`Termo “${termo.nome}” exigido na revisão e aceite.`);
    const novo = termosEmOrdem(conteudo).at(-1);
    if (novo !== undefined) {
      focarDepois(this.injector, `${idDoTermo(this.idBase(), novo.codigo)}-versao`);
    }
  }

  protected mover(codigo: string, direcao: -1 | 1): void {
    const conteudo = moverTermo(this.contexto().conteudo, codigo, direcao);
    this.conteudoChange.emit(conteudo);
    const termos = termosEmOrdem(conteudo);
    const posicao = termos.findIndex((termo) => termo.codigo === codigo) + 1;
    const nome = this.nomeDoTermo(termos[posicao - 1]?.termoId, codigo);
    this.anuncio.emit(`Termo “${nome}” movido para a posição ${posicao} de ${termos.length}.`);
    const prefixo = idDoTermo(this.idBase(), codigo);
    const [mesmo, oposto] = direcao < 0 ? ['subir', 'descer'] : ['descer', 'subir'];
    focarDepois(this.injector, `${prefixo}-${mesmo}`, `${prefixo}-${oposto}`);
  }

  protected remover(codigo: string): void {
    const termo = (this.contexto().conteudo.termos ?? []).find((t) => t.codigo === codigo);
    this.conteudoChange.emit(removerTermo(this.contexto().conteudo, codigo));
    this.anuncio.emit(`Termo “${this.nomeDoTermo(termo?.termoId, codigo)}” deixou de ser exigido.`);
    focarDepois(this.injector, `${this.idBase()}-termo`, `${this.idBase()}-titulo`);
  }
}
