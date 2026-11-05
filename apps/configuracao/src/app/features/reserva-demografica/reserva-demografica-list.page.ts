import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReferenciaReservaDemograficaDto } from '@uniplus/shared-data/configuracao';
import { AlertComponent, DialogComponent } from '@uniplus/shared-ui/components';
import { ReservaDemograficaListaComponent } from './reserva-demografica-lista.component';
import { ReservaDemograficaFormularioComponent } from './reserva-demografica-formulario.component';
import { EdicaoDasReservasDemograficas } from './edicao-das-reservas-demograficas';
import { ReservaDemograficaStore } from './reserva-demografica.store';

@Component({
  selector: 'cfg-reserva-demografica-page',
  standalone: true,
  imports: [
    AlertComponent,
    DialogComponent,
    ReservaDemograficaListaComponent,
    ReservaDemograficaFormularioComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reserva-demografica-list.page.html',
  providers: [ReservaDemograficaStore, EdicaoDasReservasDemograficas],
  host: { class: 'cfg-page' },
})
export class ReservaDemograficaListPage {
  protected readonly store = inject(ReservaDemograficaStore);
  protected readonly edicao = inject(EdicaoDasReservasDemograficas);
  protected readonly busca = this.store.busca;
  protected readonly loading = this.store.carregando;
  protected readonly prevCursor = this.store.anterior;
  protected readonly nextCursor = this.store.proximo;
  protected readonly referencias = this.store.referencias;
  protected readonly referenciasFiltradas = this.store.referenciasFiltradas;
  protected readonly errorMessage = this.store.mensagemDeErro;
  protected readonly form = this.edicao.form;
  protected readonly formOpen = this.edicao.formOpen;
  protected readonly confirmOpen = this.edicao.confirmOpen;
  protected readonly formError = this.edicao.formError;
  protected readonly modo = this.edicao.modo;
  protected readonly formHeading = this.edicao.formHeading;
  protected readonly mensagemRemocao = this.edicao.mensagemRemocao;
  protected readonly saving = this.edicao.saving;
  protected pct(valor: number): string {
    return Number.isFinite(valor) ? valor.toFixed(2) : String(valor);
  }
  protected proximaPagina(): void {
    this.store.proximaPagina();
  }
  protected paginaAnterior(): void {
    this.store.paginaAnterior();
  }
  protected tentarNovamente(): void {
    this.store.tentarNovamente();
  }
  protected abrirCadastro(): void {
    this.edicao.abrirCadastro();
  }
  protected abrirEdicao(ref: ReferenciaReservaDemograficaDto): void {
    this.edicao.abrirEdicao(ref);
  }
  protected verificarCensoDuplicado(): void {
    this.edicao.verificarCensoDuplicado();
  }
  protected pedirRemocao(ref: ReferenciaReservaDemograficaDto): void {
    this.edicao.pedirRemocao(ref);
  }
  protected removerConfirmado(): void {
    this.edicao.removerConfirmado();
  }
  protected salvar(): void {
    this.edicao.salvar();
  }
  protected erroDoCampo(nome: keyof typeof this.form.controls): string | null {
    return this.edicao.erroDoCampo(nome);
  }
}
