import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
} from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focarAposNovaTentativa, focoEstaLivre } from '../../shared/foco';
import { CursoFormularioComponent } from './curso-formulario.component';
import { CursosListaComponent } from './cursos-lista.component';
import { CursosStore } from './cursos.store';
import { EdicaoDosCursos } from './edicao-dos-cursos';
import { GruposDoCurso } from './grupos-do-curso';
import { OfertasDoCursoComponent } from './ofertas-do-curso.component';
import { OfertasDoCursoStore } from './ofertas-do-curso.store';

/** Cadastro de cursos: compõe a lista, o formulário, a confirmação de remoção e as ofertas. */
@Component({
  selector: 'cfg-cursos-page',
  standalone: true,
  providers: [CursosStore, EdicaoDosCursos, GruposDoCurso, OfertasDoCursoStore],
  imports: [
    AlertComponent,
    ConfirmacaoDeRemocaoComponent,
    CursoFormularioComponent,
    CursosListaComponent,
    OfertasDoCursoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cursos.page.html',
  host: { class: 'cfg-page' },
})
export class CursosPage {
  protected readonly store = inject(CursosStore);
  protected readonly edicao = inject(EdicaoDosCursos);
  protected readonly grupos = inject(GruposDoCurso);
  protected readonly ofertas = inject(OfertasDoCursoStore);
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-cursos-list-title'),
  );

  private readonly novaTentativaDasOfertas = focarAposNovaTentativa(
    this.ofertas.carregando,
    computed(() => this.ofertas.mensagemDeErro() !== null),
    () => this.raiz.querySelector<HTMLElement>('cfg-ofertas-do-curso button[aria-label="Fechar"]'),
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }

  protected recarregarOfertas(): void {
    this.novaTentativaDasOfertas.executar(() => this.ofertas.recarregar());
  }

  /**
   * Ao fechar as ofertas o drawer devolve o foco a quem o abriu. Quando a remoção bloqueada o
   * abriu, esse alguém era o diálogo de confirmação, já fechado: o foco vai à ação da linha, ou
   * ao título da lista se a linha não existe mais.
   */
  protected aoFecharOfertas(): void {
    const cursoId = this.ofertas.cursoId();
    const porBloqueio = this.ofertas.bloqueio() !== null;
    this.ofertas.aoFechar();
    afterNextRender(
      () => {
        if (focoEstaLivre()) {
          this.acionadorDoCurso(cursoId, porBloqueio)?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  private acionadorDoCurso(cursoId: string | null, porBloqueio: boolean): HTMLElement | null {
    const prefixo = porBloqueio ? 'Remover ' : 'Ofertas de ';
    const acionador =
      cursoId === null
        ? null
        : this.raiz.querySelector<HTMLElement>(
            `tr[data-curso-id="${cursoId}"] button[aria-label^="${prefixo}"]:not(:disabled)`,
          );
    return acionador ?? this.raiz.querySelector<HTMLElement>('#cfg-cursos-list-title');
  }
}
