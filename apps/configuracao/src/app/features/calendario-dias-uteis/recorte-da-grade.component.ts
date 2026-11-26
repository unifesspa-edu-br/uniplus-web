import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SelectComponent } from '@uniplus/shared-ui/components';
import { RecorteDaExibicao } from './recorte-da-exibicao';
import { ID_DO_CAMPO_DE_ABRANGENCIA } from './recorte-da-exibicao.util';

/** Os campos que escolhem quais dias não úteis a grade mostra, com o aviso de que ocultar não remove. */
@Component({
  selector: 'cfg-recorte-da-grade',
  standalone: true,
  imports: [ReactiveFormsModule, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recorte-da-grade.component.html',
  styleUrl: './recorte-da-grade.component.css',
})
export class RecorteDaGradeComponent {
  protected readonly recorte = inject(RecorteDaExibicao);

  protected readonly idDaAbrangencia = ID_DO_CAMPO_DE_ABRANGENCIA;
  protected readonly idDoAviso = 'cfg-recorte-aviso';
  /** O aviso só existe com filtro ativo; apontar para ele sem existir deixaria o campo com descrição vazia. */
  protected readonly avisoDosCampos = computed(() =>
    this.recorte.ativo() ? this.idDoAviso : null,
  );
  private readonly campoDaAbrangencia = viewChild.required('abrangencia', { read: ElementRef });

  /** O botão some quando não há filtro: o foco vai para o primeiro campo, em vez de cair no corpo. */
  protected mostrarTodos(): void {
    this.recorte.limpar();
    this.campoDaAbrangencia().nativeElement.querySelector('select')?.focus();
  }
}
