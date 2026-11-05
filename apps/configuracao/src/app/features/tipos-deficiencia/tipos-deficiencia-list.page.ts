import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TipoDeficienciaDto } from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  SkeletonComponent,
  SpinnerComponent,
  DialogComponent,
} from '@uniplus/shared-ui/components';
import { TiposDeficienciaListaComponent } from './tipos-deficiencia-lista.component';
import { TipoDeficienciaFormularioComponent } from './tipo-deficiencia-formulario.component';
import { TiposDeficienciaStore } from './tipos-deficiencia.store';
import { EdicaoDosTiposDeficiencia } from './edicao-dos-tipos-deficiencia';

@Component({
  selector: 'cfg-tipos-deficiencia-list',
  imports: [
    AlertComponent,
    SkeletonComponent,
    SpinnerComponent,
    DialogComponent,
    TiposDeficienciaListaComponent,
    TipoDeficienciaFormularioComponent,
  ],
  templateUrl: './tipos-deficiencia-list.page.html',
  providers: [TiposDeficienciaStore, EdicaoDosTiposDeficiencia],
  host: { class: 'cfg-page' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TiposDeficienciaListPage {
  protected readonly store = inject(TiposDeficienciaStore);
  protected readonly edicao = inject(EdicaoDosTiposDeficiencia);
  protected readonly termoBusca = this.store.termoBusca;
  protected readonly loading = this.store.carregando;
  protected readonly prevCursor = this.store.anterior;
  protected readonly nextCursor = this.store.proximo;
  protected readonly tiposDeficiencia = this.store.tiposDeficiencia;
  protected readonly tiposDeficienciaFiltrados = this.store.tiposDeficienciaFiltrados;
  protected readonly errorMessage = this.store.mensagemDeErro;
  protected readonly temFiltro = this.store.temFiltro;
  protected readonly formHeading = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de deficiência' : 'Editar tipo de deficiência',
  );
  readonly modo = this.edicao.modo;
  readonly form = this.edicao.form;
  readonly formOpen = this.edicao.formOpen;
  readonly saving = this.edicao.saving;
  readonly submitting = this.edicao.gravando;
  readonly formError = this.edicao.formError;
  readonly idempotencyKeyAtual = this.edicao.idempotencyKeyAtual;
  readonly tipoDeficienciaParaRemover = this.edicao.tipoDeficienciaParaRemover;
  readonly confirmOpen = this.edicao.confirmOpen;

  tentarNovamente(): void {
    if (!this.edicao.gravando() && !this.store.carregando()) this.store.tentarNovamente();
  }
  abrirDrawerCriacao(): void {
    this.edicao.abrirDrawerCriacao();
  }
  protected abrirEdicao(tipo: TipoDeficienciaDto): void {
    this.edicao.abrirEdicao(tipo);
  }
  abrirRemoverTipoDeficiencia(tipo: TipoDeficienciaDto): void {
    this.edicao.abrirRemoverTipoDeficiencia(tipo);
  }
  protected salvar(): void {
    this.edicao.salvar();
  }
  protected proximaPagina(): void {
    this.store.proximaPagina();
  }
  protected paginaAnterior(): void {
    this.store.paginaAnterior();
  }
  protected removerConfirmado(): void {
    this.edicao.removerConfirmado();
  }
}
