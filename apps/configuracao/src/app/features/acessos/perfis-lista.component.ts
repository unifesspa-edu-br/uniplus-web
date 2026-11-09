import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PerfilListadoDto } from '@uniplus/shared-data/autorizacao';
import {
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { sensibilidade } from './rotulos-de-acesso';
import { acoesDoPerfil, resumoDoPerfil, situacoesDoPerfil } from './versoes/estado-do-perfil';

@Component({
  selector: 'cfg-perfis-lista',
  standalone: true,
  imports: [
    EmptyStateComponent,
    IconButtonComponent,
    PagerComponent,
    RouterLink,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './perfis-lista.component.html',
})
export class PerfisListaComponent {
  readonly perfis = input.required<readonly PerfilListadoDto[]>();
  readonly carregando = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly gravando = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly alternarAtivacao = output<PerfilListadoDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected readonly sensibilidadeDe = sensibilidade;
  protected readonly situacoes = (perfil: PerfilListadoDto) =>
    situacoesDoPerfil(resumoDoPerfil(perfil));
  protected readonly acoes = (perfil: PerfilListadoDto) => acoesDoPerfil(resumoDoPerfil(perfil));
  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());
}
