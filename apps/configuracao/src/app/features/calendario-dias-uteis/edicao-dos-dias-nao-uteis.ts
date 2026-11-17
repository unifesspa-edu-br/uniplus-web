import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import {
  ApiResult,
  type CausaDeCampo,
  ProblemDetails,
  ProblemI18nService,
  separarCausas,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CalendarioDiasUteisApi, CalendarioDiasUteisDto } from '@uniplus/shared-data/configuracao';
import { aguardarRecarga } from '../../shared/foco';
import { PARA_SIGLA, DATA_DUPLICADA_MESSAGE } from './calendario-dias-uteis.util';
import { BuscaDeMunicipios } from './busca-de-municipios';
import { CalendarioStore } from './calendario.store';
import { aplicarErroNoDia, comandoDoDiaNaoUtil, criarGrupoDeDiaNaoUtil } from './dia-nao-util-form';
import { aplicarPoliticaDaFalha, TipoDeFalha } from './falha-do-calendario';
import { SelecaoDoDia } from './selecao-do-dia';
import { descartarRecusasDoServidor, textoDasCausasGerais } from '../../shared/formulario';

const ORIENTACAO_DA_DUPLICIDADE =
  'Escolha outra abrangência ou região, ou cancele para manter o que já está cadastrado.';

/**
 * A escrita do detalhe: a inclusão de um dia não útil no calendário aberto. Dona do formulário do
 * diálogo e do indicador de gravação, então uma inclusão impede a outra.
 */
@Injectable()
export class EdicaoDosDiasNaoUteis {
  private readonly api = inject(CalendarioDiasUteisApi);
  private readonly store = inject(CalendarioStore);
  private readonly selecao = inject(SelecaoDoDia);
  private readonly buscaMunicipios = inject(BuscaDeMunicipios);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarGrupoDeDiaNaoUtil();
  readonly aberto = signal(false);
  private readonly escrita = signal(false);
  readonly salvando = this.escrita.asReadonly();
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  /** Inclui a espera pela recarga: o calendário só reflete a inclusão quando ela termina. */
  readonly gravando = computed(() => this.escrita() || this.recarga.aguardando());
  /** A recusa que vale para o formulário inteiro, sem campo próprio onde caber. */
  readonly erro = signal<string | null>(null);
  private readonly recusa = signal('');
  private readonly chave = signal(idempotencyKey.create());

  /** Dentro do diálogo: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncio = computed(() =>
    this.salvando() ? 'Adicionando o dia não útil.' : this.recusa(),
  );

  /** A data vem do dia clicado na grade e não se edita: o campo fica à vista como contexto. */
  abrirCadastro(): void {
    if (this.salvando()) {
      return;
    }
    this.chave.set(idempotencyKey.create());
    this.reiniciar();
    this.form.controls.data.setValue(this.selecao.dia()?.data ?? '');
    this.form.controls.data.disable();
    this.aberto.set(true);
  }

  fechar(): void {
    if (!this.salvando()) {
      this.aberto.set(false);
    }
  }

  /** `reset` devolve os valores, não os validadores: o da abrangência municipal é reposto por ela. */
  reiniciar(): void {
    this.erro.set(null);
    this.recusa.set('');
    this.form.reset({
      data: '',
      abrangencia: 'ESTADUAL',
      codigoMunicipio: '',
      uf: PARA_SIGLA,
      buscaMunicipio: '',
      descricao: '',
      municipioNome: null,
      municipioUf: null,
    });
    this.buscaMunicipios.aplicar(this.form, { tipo: 'abrangencia' });
  }

  salvar(): void {
    this.erro.set(null);
    this.recusa.set('');
    descartarRecusasDoServidor(this.form);
    // A tela do campo reavalia os erros por evento do grupo, e o descarte não emite.
    this.form.updateValueAndValidity();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const contexto = withIdempotencyKey(this.chave());
    this.gravar(
      this.api.criaNovaData(this.store.calendarioId(), comandoDoDiaNaoUtil(this.form), contexto),
    );
  }

  private gravar(operacao: Observable<ApiResult<CalendarioDiasUteisDto | void>>): void {
    if (this.escrita()) {
      return;
    }
    this.escrita.set(true);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      this.concluir(result);
      this.escrita.set(false);
    });
  }

  private concluir(result: ApiResult<CalendarioDiasUteisDto | void>): void {
    if (!result.ok) {
      this.aplicarFalha(result.problem);
      this.recusa.set(this.erro() ? '' : 'Revise os campos indicados.');
      return;
    }
    this.notifications.success('Dia não útil adicionado');
    // A chave gasta fica associada ao corpo já aceito: reutilizá-la devolveria `body_mismatch`.
    this.chave.set(idempotencyKey.create());
    this.aberto.set(false);
    this.selecao.fecharPainel();
    this.recarga.iniciar();
    this.store.recarregar();
  }

  private aplicarFalha(problem: ProblemDetails): void {
    const falha = aplicarPoliticaDaFalha(problem, this.chave, this.notifications);
    const causas = separarCausas(problem.errors);
    const apontou = falha.tipo === 'campos' && this.aplicarErrosDeValidacao(causas.deCampo);
    const geral = textoDasCausasGerais(causas.gerais);
    this.erro.set(this.textoDaRecusa(problem, falha.tipo, geral, apontou));
  }

  /**
   * A data vem do dia clicado e não se edita aqui, então a duplicidade não tem campo onde ser
   * corrigida: o alerta diz o que ainda dá para mudar, para a tentativa seguinte ser diferente. A
   * causa geral, quando a API envia, dá o motivo no lugar do texto padrão e a orientação continua.
   */
  private textoDaRecusa(
    problem: ProblemDetails,
    tipo: TipoDeFalha,
    geral: string | null,
    apontou: boolean,
  ): string | null {
    if (tipo === 'dataDuplicada') {
      return `${geral ?? DATA_DUPLICADA_MESSAGE} ${ORIENTACAO_DA_DUPLICIDADE}`;
    }
    return geral ?? (apontou ? null : this.problemI18n.resolve(problem).title);
  }

  private aplicarErrosDeValidacao(errors: readonly CausaDeCampo[]): boolean {
    let aplicouAlgum = false;
    for (const erro of errors) {
      aplicouAlgum = aplicarErroNoDia(this.form, erro) || aplicouAlgum;
    }
    return aplicouAlgum;
  }
}
