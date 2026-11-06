import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CalendarioDiasUteisApi } from '@uniplus/shared-data/configuracao';
import {
  controlNameFromBackendField,
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
} from '../../shared/formulario';
import { BuscaDeMunicipios } from './busca-de-municipios';
import {
  CalendarioForm,
  comandoDeCriacaoDoCalendario,
  criarFormularioDeCalendario,
} from './calendario-form';
import {
  aplicarErroNoDia,
  criarGrupoDeDiaNaoUtil,
  GrupoDoDia,
  indiceDoDiaNoServidor,
} from './dia-nao-util-form';
import { aplicarPoliticaDaFalha } from './falha-do-calendario';

export const SEM_DIA_NAO_UTIL = 'Ao menos um dia não útil é obrigatório';
const ROTA_DA_LISTA = '/calendario-dias-uteis';
const CAMPO_DA_VERSAO: ReadonlySet<string> = new Set(['versaoDataset']);

/**
 * A escrita da tela de novo calendário: o formulário com os dias, a criação e o estado dela.
 * Enquanto a criação corre, uma segunda não parte.
 */
@Injectable()
export class EdicaoDoCalendario {
  private readonly api = inject(CalendarioDiasUteisApi);
  private readonly buscaMunicipios = inject(BuscaDeMunicipios);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly form: FormGroup<CalendarioForm> = criarFormularioDeCalendario();
  private readonly escrita = signal(false);
  readonly salvando = this.escrita.asReadonly();
  readonly erro = signal<string | null>(null);
  private readonly recusa = signal('');
  private readonly chave = signal(idempotencyKey.create());

  /** Dentro do formulário: o andamento e a recusa, que só fazem sentido enquanto ele está na tela. */
  readonly anuncio = computed(() => (this.salvando() ? 'Criando o calendário.' : this.recusa()));

  adicionarDia(): void {
    this.form.controls.diasNaoUteis.push(criarGrupoDeDiaNaoUtil());
  }

  removerDia(grupo: GrupoDoDia): void {
    const indice = this.form.controls.diasNaoUteis.controls.indexOf(grupo);
    if (indice < 0 || this.salvando()) {
      return;
    }
    this.form.controls.diasNaoUteis.removeAt(indice);
    this.buscaMunicipios.descartar(grupo);
  }

  salvar(): void {
    this.erro.set(null);
    this.recusa.set('');
    descartarRecusasDoServidor(this.form);
    // A tela do campo reavalia os erros por evento do grupo do dia, e o descarte não emite.
    this.form.controls.diasNaoUteis.controls.forEach((dia) => dia.updateValueAndValidity());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.form.controls.diasNaoUteis.length === 0) {
      this.erro.set(SEM_DIA_NAO_UTIL);
      return;
    }
    const comando = comandoDeCriacaoDoCalendario(this.form);
    this.gravar(this.api.criar(comando, withIdempotencyKey(this.chave())));
  }

  private gravar(operacao: Observable<ApiResult<string>>): void {
    if (this.escrita()) {
      return;
    }
    this.escrita.set(true);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      this.concluir(result);
      this.escrita.set(false);
    });
  }

  private concluir(result: ApiResult<string | void>): void {
    if (result.ok) {
      this.notifications.success('Calendário criado');
      void this.router.navigateByUrl(ROTA_DA_LISTA);
      return;
    }
    this.aplicarFalha(result.problem);
    this.recusa.set(this.erro() ? '' : 'Revise os campos indicados.');
  }

  private aplicarFalha(problem: ProblemDetails): void {
    const falha = aplicarPoliticaDaFalha(problem, this.chave, this.notifications);
    const apontou = falha.tipo === 'campos' && this.aplicarErrosDeValidacao(problem.errors ?? []);
    this.erro.set(apontou ? null : this.problemI18n.resolve(problem).title);
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): boolean {
    let aplicouAlgum = false;
    for (const erro of errors) {
      aplicouAlgum = this.aplicarErro(erro) || aplicouAlgum;
    }
    return aplicouAlgum;
  }

  private aplicarErro(erro: ProblemValidationError): boolean {
    const indice = indiceDoDiaNoServidor(erro.field);
    if (indice === null) {
      return this.aplicarNaVersao(erro);
    }
    const grupo = this.form.controls.diasNaoUteis.controls.at(indice);
    return grupo !== undefined && aplicarErroNoDia(grupo, erro);
  }

  private aplicarNaVersao(erro: ProblemValidationError): boolean {
    if (controlNameFromBackendField(erro.field, CAMPO_DA_VERSAO) === null) {
      return false;
    }
    marcarRecusaDoServidor(this.form.controls.versaoDataset, erro.code, erro.message);
    return true;
  }
}
