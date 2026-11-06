import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { TipoDeficienciaApi, TipoDeficienciaDto } from '@uniplus/shared-data/configuracao';
import { ligarCodigoDeCadastro } from '../../shared/codigo-de-cadastro';
import { ItemDaConfirmacao } from '../../shared/confirmacao-de-remocao';
import { aguardarRecarga } from '../../shared/foco';
import {
  TIPO_EM_BRANCO,
  TipoDeficienciaForm,
  ValoresDoTipoDeficiencia,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeTipoDeficiencia,
  valoresDoTipoDeficiencia,
} from './tipo-deficiencia-form';
import { TiposDeficienciaStore } from './tipos-deficiencia.store';
import { type AndamentoDaEscrita, ROTULOS_PADRAO_DA_ESCRITA } from '../../shared/escrita';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  marcarRecusasDosCampos,
  MENSAGEM_SEM_MAPEAMENTO,
} from '../../shared/formulario';

type ModoFormulario = 'criar' | 'editar';
type Escrita = 'salvando' | 'removendo';

/**
 * Conflitos de unicidade (409) que pertencem a um campo do formulário: o corpo não traz
 * `errors[]`, então só o código de wire diz a qual campo o conflito se refere.
 */
const CAMPO_POR_CONFLITO: ReadonlyMap<string, keyof TipoDeficienciaForm> = new Map([
  ['uniplus.configuracao.tipo_deficiencia.codigo_ja_existe', 'codigo' as const],
  ['uniplus.configuracao.tipo_deficiencia.nome_ja_existe', 'nome' as const],
]);

/**
 * Todas as escritas da tela de tipos de deficiência: o formulário, o salvamento e a
 * remoção com confirmação. É a única dona do indicador de gravação, então uma escrita impede a
 * outra.
 */
@Injectable()
export class EdicaoDosTiposDeficiencia {
  private readonly api = inject(TipoDeficienciaApi);
  private readonly store = inject(TiposDeficienciaStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeTipoDeficiencia();
  private readonly escrita = signal<Escrita | null>(null);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  private readonly emAndamento = signal<AndamentoDaEscrita | null>(null);
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.recarga.aguardando());
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  readonly andamento = computed(() => (this.gravando() ? this.emAndamento() : null));

  readonly aberto = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  readonly erro = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly erroDaRemocao = signal<string | null>(null);
  private readonly tipoEmEdicaoId = signal<string | null>(null);
  /** Classificação de permanência do registro em edição: lida, reenviada, não editável aqui. */
  private readonly permanenteEmEdicao = signal<boolean | null>(null);
  private readonly tipoParaRemover = signal<TipoDeficienciaDto | null>(null);
  private readonly resultadoDaRemocao = signal('');
  private readonly chave = signal(idempotencyKey.create());
  private readonly ligacaoDoCodigo = ligarCodigoDeCadastro(
    this.form.controls,
    () => this.modo() === 'criar',
  );

  readonly titulo = computed(() =>
    this.modo() === 'criar' ? 'Novo tipo de deficiência' : 'Editar tipo de deficiência',
  );
  readonly itemDaConfirmacao = computed<ItemDaConfirmacao | null>(() => {
    const tipo = this.tipoParaRemover();
    return tipo
      ? {
          abertura: 'Você está prestes a remover o tipo de deficiência',
          nome: tipo.nome,
          codigo: tipo.codigo,
        }
      : null;
  });
  readonly mensagemDaConfirmacao = computed(() =>
    this.tipoParaRemover()
      ? 'A remoção impede novos editais de utilizá-lo, mas não altera ofertas já congeladas — a cópia por valor de cada processo permanece íntegra.'
      : 'Deseja remover este tipo de deficiência?',
  );
  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const tipo = this.tipoParaRemover();
    if (tipo === null) return '';
    if (this.removendo()) return `Removendo o tipo de deficiência ${tipo.nome}.`;
    const motivo = this.erroDaRemocao();
    return motivo ? `Não foi possível remover o tipo de deficiência ${tipo.nome}. ${motivo}` : '';
  });
  /** Dentro do drawer: o andamento, que só faz sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando tipo de deficiência.' : '',
  );
  /** Na página: a remoção concluída, anunciada quando o diálogo já não está aberto para dizê-la. */
  readonly anuncioDaPagina = computed(() => (this.confirmando() ? '' : this.resultadoDaRemocao()));

  abrirCadastro(): void {
    if (this.gravando()) return;
    this.preparar('criar', null, TIPO_EM_BRANCO, null);
  }

  abrirEdicao(tipo: TipoDeficienciaDto): void {
    if (this.gravando()) return;
    this.preparar('editar', tipo.id, valoresDoTipoDeficiencia(tipo), tipo.permanente);
  }

  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }

  pedirRemocao(tipo: TipoDeficienciaDto): void {
    if (this.gravando()) return;
    this.resultadoDaRemocao.set('');
    this.erroDaRemocao.set(null);
    this.tipoParaRemover.set(tipo);
    this.confirmando.set(true);
  }

  salvar(): void {
    this.erro.set(null);
    descartarRecusasDoServidor(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.tipoEmEdicaoId();
    const valores = this.form.getRawValue();
    const chave = withIdempotencyKey(this.chave());
    const operacao: Observable<ApiResult<string | void>> =
      id === null
        ? this.api.criar(comandoDeCriacao(valores), chave)
        : this.api.atualizar(
            id,
            comandoDeAtualizacao(id, valores, this.permanenteEmEdicao()),
            chave,
          );
    this.gravar('salvando', id, operacao, (result) => this.concluirSalvamento(result));
  }

  removerConfirmado(): void {
    const tipo = this.tipoParaRemover();
    if (tipo === null) return;
    this.erroDaRemocao.set(null);
    this.gravar('removendo', tipo.id, this.api.remover(tipo.id), (result) =>
      this.concluirRemocao(tipo, result),
    );
  }

  private preparar(
    modo: ModoFormulario,
    id: string | null,
    valores: ValoresDoTipoDeficiencia,
    permanente: boolean | null,
  ): void {
    this.modo.set(modo);
    this.tipoEmEdicaoId.set(id);
    this.permanenteEmEdicao.set(permanente);
    this.ligacaoDoCodigo.reiniciar();
    this.form.reset(valores);
    this.erro.set(null);
    this.renovarChave();
    this.aberto.set(true);
  }

  private gravar<T>(
    tipo: Escrita,
    id: string | null,
    operacao: Observable<ApiResult<T>>,
    concluir: (result: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) return;
    this.escrita.set(tipo);
    this.emAndamento.set(id === null ? null : { id, rotulo: ROTULOS_PADRAO_DA_ESCRITA[tipo] });
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      concluir(result);
      this.escrita.set(null);
    });
  }

  private concluirSalvamento(result: ApiResult<string | void>): void {
    if (!result.ok) {
      this.aplicarFalha(result.problem);
      return;
    }
    this.notifications.success(
      this.modo() === 'criar' ? 'Tipo de deficiência criado' : 'Tipo de deficiência atualizado',
    );
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(tipo: TipoDeficienciaDto, result: ApiResult<void>): void {
    if (!result.ok) {
      const titulo = this.problemI18n.resolve(result.problem).title;
      this.erroDaRemocao.set(titulo);
      if (result.problem.status >= 500) {
        this.notifications.errorFromProblem(result.problem, { title: titulo });
      }
      return;
    }
    this.resultadoDaRemocao.set(`Tipo de deficiência ${tipo.nome} removido.`);
    this.notifications.success('Tipo de deficiência removido');
    this.confirmando.set(false);
    this.tipoParaRemover.set(null);
    this.recarregar();
  }

  private recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
      this.renovarChave();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    const campo = CAMPO_POR_CONFLITO.get(problem.code);
    if (campo !== undefined) {
      this.renovarChave();
      marcarRecusaDoServidor(
        this.form.controls[campo],
        problem.code,
        this.problemI18n.resolve(problem).title,
      );
      return;
    }
    if (deveRotacionarIdempotencyKey(problem)) this.renovarChave();
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    const aplicou = marcarRecusasDosCampos(errors, this.form, controleDoCampoDoServidor);
    this.erro.set(aplicou ? null : MENSAGEM_SEM_MAPEAMENTO);
  }

  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }
}
