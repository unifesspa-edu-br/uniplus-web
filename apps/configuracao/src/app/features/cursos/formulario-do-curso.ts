import { Injectable, computed, inject, signal } from '@angular/core';
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
import { mensagemDeErroDoControle, nullIfBlank } from '../../shared/formulario';
import { CatalogoGruposAreaEnem } from '../../shared/grupos-area-enem';
import { motivoDaFalha } from '../../shared/lista-de-referencia';
import { comPontoFinal } from '../../shared/texto';
import {
  CURSO_EM_BRANCO,
  CursoForm,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeCurso,
  valoresDoCurso,
} from './curso-form';
import { CursosStore } from './cursos.store';

type ModoFormulario = 'criar' | 'editar';

/** Vendor code do DomainError `Curso.CodigoJaExiste` (uniplus-api, 409 Conflict). */
const CURSO_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.curso.codigo_ja_existe';

/**
 * O formulário de cadastro e edição de curso: abertura, validação, gravação, recusas do servidor e
 * o grupo de área do ENEM, cuja lista vem da API.
 */
@Injectable()
export class FormularioDoCurso {
  private readonly api = inject(CursosApi);
  private readonly store = inject(CursosStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly grupos = inject(CatalogoGruposAreaEnem);

  readonly form = criarFormularioDeCurso();
  readonly aberto = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  readonly erro = signal<string | null>(null);
  readonly titulo = computed(() => (this.modo() === 'criar' ? 'Novo curso' : 'Editar curso'));

  private readonly cursoEmEdicaoId = signal<string | null>(null);
  private readonly chaveDeIdempotencia = signal(idempotencyKey.create());
  /** Grupo que o curso em edição já tem, como a tela o mostra. */
  private readonly grupoDoCursoEmEdicao = signal<GrupoAreaEnemDto | null>(null);

  // Carga de fundo da tabela: só avisa quando o formulário, que depende dos grupos, está aberto.
  private readonly motivoFalhaGrupos = motivoDaFalha(this.grupos, () => this.aberto());

  readonly mensagemFalhaGrupos = computed(() => {
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
  readonly grupoForaDasOpcoes = computed<GrupoAreaEnemDto | null>(() => {
    const doCurso = this.grupoDoCursoEmEdicao();
    if (doCurso === null || this.grupos.porCodigo().has(doCurso.codigo)) {
      return null;
    }
    // Sem código não há o que selecionar nem gravar: o "—" é só da tabela.
    return nullIfBlank(doCurso.codigo) === null ? null : doCurso;
  });

  /**
   * A lista chegou depois do "Tentar novamente": o alerta sai com o botão, e o foco vai ao select
   * que a lista alimenta, sem sair do formulário.
   */
  private readonly novaTentativaDosGrupos = focarAposNovaTentativa(
    this.grupos.pendente,
    this.grupos.falhou,
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
      curso.grupoAreaEnem ? this.grupos.exibivel(curso.grupoAreaEnem) : null,
    );
    this.abrir();
  }

  fechar(): void {
    this.aberto.set(false);
  }

  erroDoCampo(nome: keyof CursoForm): string | null {
    return mensagemDeErroDoControle(this.form.controls[nome]);
  }

  /** O select do grupo é descrito pela falha da lista e pelo erro do campo, quando há. */
  descricaoDoGrupo(): string | null {
    const ids = [
      this.aberto() && this.grupos.falhou() ? 'cfg-curso-grupos-falha' : null,
      this.erroDoCampo('grupoAreaEnem') ? 'cfg-curso-grupo-erro' : null,
    ].filter((id): id is string => id !== null);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  tentarCarregarGrupos(): void {
    this.novaTentativaDosGrupos.executar(() => this.grupos.tentarDeNovo());
  }

  salvar(): void {
    if (this.store.gravando()) {
      return;
    }
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
    this.store.gravar(operacao, (result) => this.concluirGravacao(result));
  }

  private abrir(): void {
    this.grupos.garantirCarregado();
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
