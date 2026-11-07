import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
} from '@angular/core';
import { acompanharLeitura, FalhaDeLeituraComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focoEstaLivre } from '../../shared/foco';
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
    ConfirmacaoDeRemocaoComponent,
    CursoFormularioComponent,
    CursosListaComponent,
    FalhaDeLeituraComponent,
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
  protected readonly leitura = acompanharLeitura({
    assunto: 'cursos',
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-cursos-list-title'),
  });

  protected readonly leituraDasOfertas = acompanharLeitura({
    assunto: 'ofertas',
    falha: this.ofertas.mensagemDeErro,
    pendente: this.ofertas.carregando,
    recarregar: () => this.ofertas.recarregar(),
    destino: () =>
      this.raiz.querySelector<HTMLElement>('cfg-ofertas-do-curso button[aria-label="Fechar"]'),
  });

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
