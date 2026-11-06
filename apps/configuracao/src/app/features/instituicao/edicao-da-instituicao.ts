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
import { InstituicaoApi, InstituicaoDto } from '@uniplus/shared-data/organizacao';
import { ehErroDeEndereco } from '../../shared/endereco';
import { aguardarRecarga } from '../../shared/foco';
import {
  INSTITUICAO_JA_EXISTE_CODE,
  INSTITUICAO_NAO_ENCONTRADA_CODE,
  UNIDADE_RAIZ_INVALIDA_CODES,
  ValoresDaInstituicao,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeInstituicao,
  valoresDaInstituicao,
  valoresEmBrancoDaInstituicao,
} from './instituicao-form';
import { InstituicaoStore } from './instituicao.store';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  MENSAGEM_SEM_MAPEAMENTO,
} from '../../shared/formulario';

/**
 * Mensagem do alerta quando o backend recusa uma segunda criação (409 singleton).
 */
const SINGLETON_CONFLITO_MSG =
  'Já existe uma instituição cadastrada nesta instância da plataforma. ' +
  'Para criar uma nova, primeiro remova a existente.';

/** Recusas que dizem que a tela mostra um estado que o servidor já não tem: a leitura é refeita. */
const DIVERGENCIAS_DO_ESTADO_DA_TELA: ReadonlySet<string> = new Set([
  INSTITUICAO_JA_EXISTE_CODE,
  INSTITUICAO_NAO_ENCONTRADA_CODE,
]);

type Escrita = 'salvando' | 'removendo';
type ModoFormulario = 'criar' | 'editar';

/**
 * As escritas da Instituição: o formulário de cadastro e edição (abertura, validação, recusas do
 * servidor) e a remoção com confirmação. Salvar e remover compartilham um só indicador, então
 * enquanto uma escrita está em curso a outra não parte.
 */
@Injectable()
export class EdicaoDaInstituicao {
  private readonly api = inject(InstituicaoApi);
  private readonly store = inject(InstituicaoStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeInstituicao();
  private readonly escrita = signal<Escrita | null>(null);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  /** Inclui a espera pela recarga: a tela só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.recarga.aguardando());
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');

  readonly aberto = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  readonly erro = signal<string | null>(null);
  readonly erroDoEndereco = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly erroDaRemocao = signal<string | null>(null);
  private readonly instituicaoParaRemover = signal<InstituicaoDto | null>(null);
  private readonly instituicaoEmEdicao = signal<InstituicaoDto | null>(null);
  private readonly recusaDoSalvamento = signal('');
  private readonly resultado = signal('');
  private readonly chave = signal(idempotencyKey.create());

  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando instituição.' : this.recusaDoSalvamento(),
  );
  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const instituicao = this.instituicaoParaRemover();
    if (instituicao === null) {
      return '';
    }
    if (this.removendo()) {
      return `Removendo a instituição ${instituicao.sigla}.`;
    }
    const motivo = this.erroDaRemocao();
    return motivo ? `Não foi possível remover a instituição ${instituicao.sigla}. ${motivo}` : '';
  });
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.aberto() ? '' : this.resultado(),
  );

  abrirCadastro(): void {
    this.abrirFormulario('criar', null, valoresEmBrancoDaInstituicao());
  }

  abrirEdicao(instituicao: InstituicaoDto): void {
    this.abrirFormulario('editar', instituicao, valoresDaInstituicao(instituicao));
  }

  fechar(): void {
    if (!this.salvando()) {
      this.aberto.set(false);
    }
  }

  /** Pede a confirmação para remover a instituição que está no formulário. */
  pedirRemocao(): void {
    const instituicao = this.instituicaoEmEdicao();
    if (instituicao === null || this.gravando()) {
      return;
    }
    this.resultado.set('');
    this.erroDaRemocao.set(null);
    this.instituicaoParaRemover.set(instituicao);
    this.confirmando.set(true);
  }

  salvar(): void {
    this.erro.set(null);
    this.erroDoEndereco.set(null);
    this.recusaDoSalvamento.set('');
    descartarRecusasDoServidor(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const existente = this.instituicaoEmEdicao();
    const modo = this.modo();
    const contexto = withIdempotencyKey(this.chave());
    const operacao: Observable<ApiResult<string | void>> =
      existente === null
        ? this.api.criar(comandoDeCriacao(this.form), contexto)
        : this.api.atualizar(existente.id, comandoDeAtualizacao(existente.id, this.form), contexto);
    this.gravar('salvando', operacao, (result) => this.concluirSalvamento(result, modo));
  }

  removerConfirmado(): void {
    const instituicao = this.instituicaoParaRemover();
    if (instituicao === null) {
      return;
    }
    this.erroDaRemocao.set(null);
    this.gravar('removendo', this.api.remover(instituicao.id), (result) =>
      this.concluirRemocao(instituicao, result),
    );
  }

  private abrirFormulario(
    modo: ModoFormulario,
    instituicao: InstituicaoDto | null,
    valores: ValoresDaInstituicao,
  ): void {
    if (this.gravando()) {
      return;
    }
    this.resultado.set('');
    this.modo.set(modo);
    this.instituicaoEmEdicao.set(instituicao);
    this.form.reset(valores);
    this.erro.set(null);
    this.erroDoEndereco.set(null);
    this.recusaDoSalvamento.set('');
    this.renovarChave();
    this.aberto.set(true);
  }

  private gravar<T>(
    tipo: Escrita,
    operacao: Observable<ApiResult<T>>,
    concluir: (result: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) {
      return;
    }
    this.escrita.set(tipo);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      concluir(result);
      this.escrita.set(null);
    });
  }

  private concluirSalvamento(result: ApiResult<string | void>, modo: ModoFormulario): void {
    if (!result.ok) {
      this.aplicarFalha(result.problem);
      this.recusaDoSalvamento.set(this.erro() ? '' : 'Revise os campos indicados.');
      return;
    }
    const criada = modo === 'criar';
    this.resultado.set(criada ? 'Instituição criada.' : 'Instituição atualizada.');
    this.notifications.success(criada ? 'Instituição criada' : 'Instituição atualizada');
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(instituicao: InstituicaoDto, result: ApiResult<void>): void {
    if (!result.ok && result.problem.status === STATUS_HTTP.NAO_ENCONTRADO) {
      this.resultado.set(`Instituição ${instituicao.sigla} já havia sido removida.`);
      this.notifications.info('Instituição já removida', instituicao.sigla);
      this.encerrarRemocao();
      return;
    }
    if (!result.ok) {
      const titulo = this.problemI18n.resolve(result.problem).title;
      this.erroDaRemocao.set(titulo);
      if (result.problem.status >= 500) {
        this.notifications.errorFromProblem(result.problem, { title: titulo });
      }
      return;
    }
    this.resultado.set(`Instituição ${instituicao.sigla} removida.`);
    this.notifications.success('Instituição removida', instituicao.sigla);
    this.encerrarRemocao();
  }

  /** Fecha o diálogo e o formulário e lê de novo, para a tela refletir que não há instituição. */
  private encerrarRemocao(): void {
    this.confirmando.set(false);
    this.instituicaoParaRemover.set(null);
    this.aberto.set(false);
    this.recarregar();
  }

  private recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }

  /**
   * Cada recusa vai ao lugar a que pertence: o campo (validação ou unidade raiz), o bloco do
   * endereço, ou o alerta do formulário (segunda criação e as demais falhas, entre elas o 409 de
   * processamento da chave, que não diz nada de campo).
   */
  private aplicarFalha(problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) {
      this.renovarChave();
    }
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
      this.aplicarErrosDeValidacao(problem.errors);
    } else if (UNIDADE_RAIZ_INVALIDA_CODES.has(problem.code)) {
      marcarRecusaDoServidor(
        this.form.controls['unidadeRaizId'],
        problem.code,
        this.problemI18n.resolve(problem).title,
      );
    } else if (ehErroDeEndereco(problem.code)) {
      this.erroDoEndereco.set(this.problemI18n.resolve(problem).title);
    } else {
      this.recusarNoAlerta(problem);
    }
  }

  private recusarNoAlerta(problem: ProblemDetails): void {
    this.erro.set(
      problem.code === INSTITUICAO_JA_EXISTE_CODE
        ? SINGLETON_CONFLITO_MSG
        : this.problemI18n.resolve(problem).title,
    );
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
    if (DIVERGENCIAS_DO_ESTADO_DA_TELA.has(problem.code)) {
      this.recarregar();
    }
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    let erroEndereco: string | null = null;
    for (const recusa of errors) {
      if (ehErroDeEndereco(recusa.field) || ehErroDeEndereco(recusa.code)) {
        erroEndereco ??= recusa.message;
        aplicouAlgum = true;
        continue;
      }
      const nome = controleDoCampoDoServidor(recusa.field);
      if (nome !== null) {
        marcarRecusaDoServidor(this.form.controls[nome], recusa.code, recusa.message);
        aplicouAlgum = true;
      }
    }
    this.erroDoEndereco.set(erroEndereco);
    this.erro.set(aplicouAlgum ? null : MENSAGEM_SEM_MAPEAMENTO);
  }

  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }
}
