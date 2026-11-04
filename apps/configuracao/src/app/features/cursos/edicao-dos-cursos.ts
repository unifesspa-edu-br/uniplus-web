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
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CursoDto, CursosApi, type GrupoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import { focarAposNovaTentativa } from '../../shared/foco';
import { nullIfBlank } from '../../shared/formulario';
import { CatalogoGruposAreaEnem } from '../../shared/grupos-area-enem';
import { motivoDaFalha } from '../../shared/lista-de-referencia';
import { comPontoFinal } from '../../shared/texto';
import {
  CURSO_EM_BRANCO,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeCurso,
  valoresDoCurso,
} from './curso-form';
import { CursosStore } from './cursos.store';
import { OfertasDoCursoStore } from './ofertas-do-curso.store';

type ModoFormulario = 'criar' | 'editar';

type Escrita = 'salvando' | 'removendo';

/** O que o formulário precisa saber do vocabulário de grupos de área do ENEM. */
export interface GruposDoFormulario {
  readonly falhou: boolean;
  readonly pendente: boolean;
  readonly tentativasSemSucesso: number;
  readonly opcoes: readonly GrupoAreaEnemDto[];
  readonly mensagemDeFalha: string;
  readonly foraDasOpcoes: GrupoAreaEnemDto | null;
}

/** Vendor code do DomainError `Curso.CodigoJaExiste` (uniplus-api, 409 Conflict). */
const CURSO_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.curso.codigo_ja_existe';

/**
 * As escritas de curso: o formulário de cadastro e edição (abertura, validação, recusas do
 * servidor e o grupo de área do ENEM, cuja lista vem da API) e a remoção com confirmação. Salvar
 * e remover compartilham um só indicador, então enquanto uma escrita está em curso a outra não
 * parte.
 */
@Injectable()
export class EdicaoDosCursos {
  private readonly api = inject(CursosApi);
  private readonly store = inject(CursosStore);
  private readonly ofertas = inject(OfertasDoCursoStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly vocabulario = inject(CatalogoGruposAreaEnem);

  readonly form = criarFormularioDeCurso();
  private readonly escrita = signal<Escrita | null>(null);
  /** Há escrita em curso, de qualquer tipo: enquanto durar, outra não parte. */
  readonly gravando = computed(() => this.escrita() !== null);
  /** O formulário está sendo enviado. */
  readonly salvando = computed(() => this.escrita() === 'salvando');
  /** Uma remoção está em curso; o formulário não foi enviado. */
  readonly removendo = computed(() => this.escrita() === 'removendo');
  /** Texto da região de status: anuncia o início e o fim da remoção. */
  readonly anuncioDaRemocao = computed(() => {
    const curso = this.cursoParaRemover();
    if (this.removendo() && curso !== null) {
      return `Removendo o curso ${curso.codigo}.`;
    }
    return this.resultadoDaRemocao();
  });
  readonly aberto = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  readonly erro = signal<string | null>(null);
  readonly titulo = computed(() => (this.modo() === 'criar' ? 'Novo curso' : 'Editar curso'));

  private readonly resultadoDaRemocao = signal('');
  readonly confirmando = signal(false);
  readonly cursoParaRemover = signal<CursoDto | null>(null);
  private readonly erroDaRemocao = signal<string | null>(null);

  readonly mensagemDaConfirmacao = computed(() => {
    const erro = this.erroDaRemocao();
    if (erro !== null) {
      return erro;
    }
    const curso = this.cursoParaRemover();
    return curso
      ? `Deseja remover ${curso.codigo} — ${curso.nome}? A remoção é lógica (soft-delete) e preserva o histórico. Se o curso for a matriz de uma oferta de curso ativa, a remoção será bloqueada.`
      : 'Deseja remover este curso?';
  });

  private readonly cursoEmEdicaoId = signal<string | null>(null);
  private readonly chaveDeIdempotencia = signal(idempotencyKey.create());
  /** Grupo que o curso em edição já tem, como a tela o mostra. */
  private readonly grupoDoCursoEmEdicao = signal<GrupoAreaEnemDto | null>(null);

  // Carga de fundo da tabela: só avisa quando o formulário, que depende dos grupos, está aberto.
  private readonly motivoFalhaGrupos = motivoDaFalha(this.vocabulario, () => this.aberto());

  private readonly mensagemFalhaGrupos = computed(() => {
    const semLista = 'Sem a lista de grupos não é possível classificar o curso.';
    const motivo = nullIfBlank(this.motivoFalhaGrupos());
    return motivo ? `${comPontoFinal(motivo)} ${semLista}` : semLista;
  });

  /**
   * Grupo do curso em edição que a lista da API não oferece — a lista ainda não chegou ou falhou.
   * Sem uma option com esse código o select apareceria em branco, mas o controle continuaria com
   * o grupo do curso, e salvar reenviaria um grupo que o operador nunca viu selecionado. A opção
   * depende do grupo original do curso, e não do valor escolhido: trocar para "Não classificado"
   * não a tira, e dá para voltar a ele.
   */
  private readonly grupoForaDasOpcoes = computed<GrupoAreaEnemDto | null>(() => {
    const doCurso = this.grupoDoCursoEmEdicao();
    if (doCurso === null || this.vocabulario.porCodigo().has(doCurso.codigo)) {
      return null;
    }
    // Sem código não há o que selecionar nem gravar: o "—" é só da tabela.
    return nullIfBlank(doCurso.codigo) === null ? null : doCurso;
  });

  readonly grupos = computed<GruposDoFormulario>(() => ({
    falhou: this.vocabulario.falhou(),
    pendente: this.vocabulario.pendente(),
    tentativasSemSucesso: this.vocabulario.tentativasSemSucesso(),
    opcoes: this.vocabulario.opcoes(),
    mensagemDeFalha: this.mensagemFalhaGrupos(),
    foraDasOpcoes: this.grupoForaDasOpcoes(),
  }));

  /**
   * A lista chegou depois do "Tentar novamente": o alerta sai com o botão, e o foco vai ao select
   * que a lista alimenta, sem sair do formulário.
   */
  private readonly novaTentativaDosGrupos = focarAposNovaTentativa(
    this.vocabulario.pendente,
    this.vocabulario.falhou,
    () => document.getElementById('cfg-curso-grupo-area-enem'),
  );

  abrirCadastro(): void {
    this.modo.set('criar');
    this.cursoEmEdicaoId.set(null);
    this.form.reset(CURSO_EM_BRANCO);
    this.grupoDoCursoEmEdicao.set(null);
    this.abrir();
  }

  abrirEdicao(curso: CursoDto): void {
    this.modo.set('editar');
    this.cursoEmEdicaoId.set(curso.id);
    this.form.reset(valoresDoCurso(curso));
    this.grupoDoCursoEmEdicao.set(
      curso.grupoAreaEnem ? this.vocabulario.exibivel(curso.grupoAreaEnem) : null,
    );
    this.abrir();
  }

  fechar(): void {
    this.aberto.set(false);
  }

  tentarCarregarGrupos(): void {
    this.novaTentativaDosGrupos.executar(() => this.vocabulario.tentarDeNovo());
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.erro.set(null);
    const chave = withIdempotencyKey(this.chaveDeIdempotencia());
    const valores = this.form.getRawValue();
    const id = this.cursoEmEdicaoId();
    const operacao: Observable<ApiResult<string | void>> =
      this.modo() === 'criar'
        ? this.api.criar(comandoDeCriacao(valores), chave)
        : this.api.atualizar(id ?? '', comandoDeAtualizacao(id ?? '', valores), chave);
    this.gravar('salvando', operacao, (result) => this.concluirGravacao(result));
  }

  pedirRemocao(curso: CursoDto): void {
    this.cursoParaRemover.set(curso);
    this.erroDaRemocao.set(null);
    this.confirmando.set(true);
  }

  removerConfirmado(): void {
    const curso = this.cursoParaRemover();
    if (curso === null) {
      return;
    }
    this.gravar('removendo', this.api.remover(curso.id), (result) => {
      if (result.ok) {
        this.resultadoDaRemocao.set(`Curso ${curso.codigo} removido.`);
        this.notifications.success('Curso removido', curso.codigo);
        this.confirmando.set(false);
        this.cursoParaRemover.set(null);
        this.store.recarregar();
        return;
      }
      this.recusarRemocao(curso, result.problem);
    });
  }

  private gravar<T>(
    tipo: Escrita,
    operacao: Observable<ApiResult<T>>,
    aoConcluir: (result: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) {
      return;
    }
    this.escrita.set(tipo);
    // Enquanto o envio corre o formulário só mostra os valores: o que se alterasse agora não iria
    // na requisição, e a recusa do servidor poderia marcar um valor já corrigido.
    if (tipo === 'salvando') {
      this.form.disable();
    }
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      this.escrita.set(null);
      if (tipo === 'salvando') {
        this.form.enable();
      }
      aoConcluir(result);
    });
  }

  private recusarRemocao(curso: CursoDto, problem: ProblemDetails): void {
    const titulo = this.problemI18n.resolve(problem).title;
    this.resultadoDaRemocao.set(`Não foi possível remover o curso ${curso.codigo}.`);
    // 409 é o único conflito possível no DELETE do curso: referenciado por oferta viva. Em vez de
    // só reexibir o texto, abre o drawer de ofertas com as que bloqueiam a remoção.
    if (problem.status === STATUS_HTTP.CONFLITO) {
      this.confirmando.set(false);
      this.cursoParaRemover.set(null);
      this.ofertas.abrirPorBloqueio(curso, titulo);
      return;
    }
    // Demais falhas (5xx, rede): mantém a confirmação aberta com a mensagem. O diálogo fecha a si
    // mesmo de forma síncrona ao emitir `confirmed`; reabrir explicitamente mantém o erro visível.
    this.erroDaRemocao.set(titulo);
    this.confirmando.set(true);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem, { title: titulo });
    }
  }

  private abrir(): void {
    this.vocabulario.garantirCarregado();
    this.erro.set(null);
    this.renovarChaveDeIdempotencia();
    this.aberto.set(true);
  }

  private concluirGravacao(result: ApiResult<string | void>): void {
    if (!result.ok) {
      this.aplicarFalha(result.problem);
      return;
    }
    this.notifications.success(this.modo() === 'criar' ? 'Curso criado' : 'Curso atualizado');
    this.aberto.set(false);
    this.renovarChaveDeIdempotencia();
    this.store.recarregar();
  }

  private aplicarFalha(problem: ProblemDetails): void {
    const errosDeCampo = problem.errors ?? [];
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && errosDeCampo.length > 0) {
      this.renovarChaveDeIdempotencia();
      this.aplicarErrosDeValidacao(errosDeCampo);
      return;
    }
    // Curso.CodigoJaExiste é um DomainError único (409, sem `errors[]` — esse array só existe no
    // pipeline FluentValidation/422); mapeado ao campo manualmente para exibir o erro inline.
    if (problem.code === CURSO_CODIGO_JA_EXISTE_CODE) {
      this.renovarChaveDeIdempotencia();
      this.marcarCodigoJaExistente(problem);
      return;
    }
    if (
      problem.status === STATUS_HTTP.CONFLITO ||
      problem.code === 'uniplus.idempotency.body_mismatch'
    ) {
      this.renovarChaveDeIdempotencia();
    }
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private marcarCodigoJaExistente(problem: ProblemDetails): void {
    this.form.controls.codigo.setErrors({
      backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
    });
    this.form.controls.codigo.markAsTouched();
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
      aplicouAlgum = this.marcarControle(erro) || aplicouAlgum;
    }
    this.erro.set(
      aplicouAlgum ? null : 'Não foi possível mapear os erros de validação. Revise os campos.',
    );
  }

  private marcarControle(erro: ProblemValidationError): boolean {
    const nome = controleDoCampoDoServidor(erro.field);
    if (nome === null) {
      return false;
    }
    const control = this.form.controls[nome];
    control.setErrors({ backend: { code: erro.code, message: erro.message } });
    control.markAsTouched();
    return true;
  }

  private renovarChaveDeIdempotencia(): void {
    this.chaveDeIdempotencia.set(idempotencyKey.create());
  }
}
