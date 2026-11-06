import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import { UnidadeDto, UnidadesApi } from '@uniplus/shared-data/organizacao';
import type { CidadeRef } from '@uniplus/shared-ui/components';
import { ehErroDeEndereco } from '../../shared/endereco';
import { aguardarRecarga } from '../../shared/foco';
import { BuscaDeCidade } from './busca-de-cidade';
import { DetalheDaUnidade } from './detalhe-da-unidade';
import { OpcoesDaUnidadeSuperior } from './opcoes-da-unidade-superior';
import {
  UnidadeForm,
  cidadeDaEdicao,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeUnidade,
  valoresDaUnidade,
  valoresEmBrancoDaUnidade,
  type ValoresDaUnidade,
} from './unidade-form';
import { UnidadesStore } from './unidades.store';
import {
  descartarRecusasDoServidor,
  marcarRecusaDoServidor,
  MENSAGEM_SEM_MAPEAMENTO,
} from '../../shared/formulario';

type Escrita = 'salvando' | 'removendo';
type ModoFormulario = 'criar' | 'editar';

/** Os 409 de duplicidade do envio: o corpo não traz `errors[]`, então o código liga ao campo. */
const CAMPO_DO_CONFLITO: Readonly<Record<string, keyof UnidadeForm>> = {
  'uniplus.organizacao.unidade.sigla_ja_existe': 'sigla',
  'uniplus.organizacao.unidade.codigo_ja_existe': 'codigo',
  'uniplus.organizacao.unidade.slug_ja_existe': 'slug',
};

/**
 * Todas as escritas da tela de unidades: o formulário, o salvamento e a remoção com confirmação.
 * É a única dona do indicador de gravação, então uma escrita impede a outra.
 */
@Injectable()
export class EdicaoDasUnidades {
  private readonly api = inject(UnidadesApi);
  private readonly store = inject(UnidadesStore);
  private readonly detalhe = inject(DetalheDaUnidade);
  private readonly opcoesDaSuperior = inject(OpcoesDaUnidadeSuperior);
  private readonly buscaDeCidade = inject(BuscaDeCidade);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeUnidade();
  private readonly escrita = signal<Escrita | null>(null);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.recarga.aguardando());
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');

  readonly aberto = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  readonly erro = signal<string | null>(null);
  /** A recusa da referência de cidade (all-or-nothing), mostrada junto ao campo de cidade. */
  readonly erroDaCidade = signal<string | null>(null);
  readonly cidade = signal<CidadeRef | null>(null);
  readonly emEdicaoId = signal<string | null>(null);
  readonly confirmando = signal(false);
  readonly erroDaRemocao = signal<string | null>(null);
  private readonly unidadeParaRemover = signal<UnidadeDto | null>(null);
  private readonly recusaDoSalvamento = signal('');
  private readonly resultado = signal('');
  private readonly chave = signal(idempotencyKey.create());

  /**
   * Um tipo vindo do backend que não casa com nenhum dos 11 conhecidos deixa o controle vazio, em
   * vez de virar "Outro" em silêncio: o envio fica bloqueado até a pessoa escolher um tipo válido.
   */
  private readonly valorDoTipo = toSignal(this.form.controls.tipo.valueChanges, {
    initialValue: this.form.controls.tipo.value,
  });
  readonly tipoNaoReconhecido = computed(() => this.valorDoTipo().trim().length === 0);

  readonly titulo = computed(() => (this.modo() === 'criar' ? 'Nova unidade' : 'Editar unidade'));
  readonly mensagemDaConfirmacao = computed(() => {
    const unidade = this.unidadeParaRemover();
    return unidade
      ? `Deseja remover ${unidade.sigla}? A remoção respeita as regras do backend para unidades subordinadas.`
      : 'Deseja remover esta unidade?';
  });
  /** Dentro do diálogo: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const unidade = this.unidadeParaRemover();
    if (unidade === null) return '';
    if (this.removendo()) return `Removendo a unidade ${unidade.sigla}.`;
    const motivo = this.erroDaRemocao();
    return motivo ? `Não foi possível remover a unidade ${unidade.sigla}. ${motivo}` : '';
  });
  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando unidade.' : this.recusaDoSalvamento(),
  );
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.aberto() ? '' : this.resultado(),
  );

  abrirCadastro(): void {
    this.abrirFormulario('criar', null, valoresEmBrancoDaUnidade(), null);
  }

  abrirEdicao(unidade: UnidadeDto): void {
    this.abrirFormulario('editar', unidade.id, valoresDaUnidade(unidade), cidadeDaEdicao(unidade));
  }

  fechar(): void {
    if (!this.salvando()) this.aberto.set(false);
  }

  /** Grava o trio inteiro da opção escolhida, nunca campo a campo. */
  selecionarCidade(cidade: CidadeRef): void {
    this.cidade.set(cidade);
    this.buscaDeCidade.reiniciar();
  }

  /** "Trocar cidade": limpa a seleção, o resíduo da busca e a recusa de uma tentativa anterior. */
  trocarCidade(): void {
    this.cidade.set(null);
    this.buscaDeCidade.reiniciar();
    this.erroDaCidade.set(null);
  }

  pedirRemocao(unidade: UnidadeDto): void {
    if (this.gravando()) return;
    this.detalhe.fechar();
    this.resultado.set('');
    this.erroDaRemocao.set(null);
    this.unidadeParaRemover.set(unidade);
    this.confirmando.set(true);
  }

  salvar(): void {
    this.erro.set(null);
    this.erroDaCidade.set(null);
    this.recusaDoSalvamento.set('');
    descartarRecusasDoServidor(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.emEdicaoId();
    const modo = this.modo();
    const valor = this.form.getRawValue();
    const contexto = withIdempotencyKey(this.chave());
    const operacao: Observable<ApiResult<string | void>> =
      id === null
        ? this.api.criar(comandoDeCriacao(valor, this.cidade()), contexto)
        : this.api.atualizar(id, comandoDeAtualizacao(id, valor, this.cidade()), contexto);
    this.gravar('salvando', operacao, (result) => this.concluirSalvamento(result, modo));
  }

  removerConfirmado(): void {
    const unidade = this.unidadeParaRemover();
    if (unidade === null) return;
    this.erroDaRemocao.set(null);
    this.gravar('removendo', this.api.remover(unidade.id), (result) =>
      this.concluirRemocao(unidade, result),
    );
  }

  private abrirFormulario(
    modo: ModoFormulario,
    id: string | null,
    valores: ValoresDaUnidade,
    cidade: CidadeRef | null,
  ): void {
    if (this.gravando()) return;
    this.detalhe.fechar();
    this.resultado.set('');
    this.modo.set(modo);
    this.emEdicaoId.set(id);
    this.form.reset(valores);
    this.cidade.set(cidade);
    this.buscaDeCidade.reiniciar();
    this.erro.set(null);
    this.erroDaCidade.set(null);
    this.recusaDoSalvamento.set('');
    this.renovarChave();
    this.opcoesDaSuperior.preparar();
    this.aberto.set(true);
  }

  private gravar<T>(
    tipo: Escrita,
    operacao: Observable<ApiResult<T>>,
    concluir: (result: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) return;
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
    this.resultado.set(criada ? 'Unidade criada.' : 'Unidade atualizada.');
    this.notifications.success(criada ? 'Unidade criada' : 'Unidade atualizada');
    this.aberto.set(false);
    this.renovarChave();
    this.recarregar();
  }

  private concluirRemocao(unidade: UnidadeDto, result: ApiResult<void>): void {
    if (!result.ok) {
      const titulo = this.problemI18n.resolve(result.problem).title;
      this.erroDaRemocao.set(titulo);
      if (result.problem.status >= 500) {
        this.notifications.errorFromProblem(result.problem, { title: titulo });
      }
      return;
    }
    this.resultado.set(`Unidade ${unidade.sigla} removida.`);
    this.notifications.success('Unidade removida', unidade.sigla);
    this.confirmando.set(false);
    this.unidadeParaRemover.set(null);
    this.recarregar();
  }

  private recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }

  /**
   * Só os 409 de duplicidade pertencem a um campo. Os demais, como o conflito de processamento da
   * chave de idempotência, não dizem nada do campo: a mensagem vai ao alerta.
   */
  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && problem.errors?.length) {
      this.renovarChave();
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }
    const campoDuplicado = CAMPO_DO_CONFLITO[problem.code];
    if (campoDuplicado !== undefined) {
      this.renovarChave();
      this.marcarCampo(campoDuplicado, problem.code, this.problemI18n.resolve(problem).title);
      return;
    }
    if (ehErroDeEndereco(problem.code)) {
      this.renovarChave();
      this.erroDaCidade.set(this.problemI18n.resolve(problem).title);
      return;
    }
    if (deveRotacionarIdempotencyKey(problem)) this.renovarChave();
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const recusa of errors) {
      if (ehErroDeEndereco(recusa.field) || ehErroDeEndereco(recusa.code)) {
        this.erroDaCidade.update((atual) => atual ?? recusa.message);
        aplicouAlgum = true;
        continue;
      }
      const nome = controleDoCampoDoServidor(recusa.field);
      if (nome === null) continue;
      this.marcarCampo(nome, recusa.code, recusa.message);
      aplicouAlgum = true;
    }
    if (!aplicouAlgum) {
      this.erro.set(MENSAGEM_SEM_MAPEAMENTO);
    }
  }

  private marcarCampo(nome: keyof UnidadeForm, code: string, message: string): void {
    const controle = this.form.controls[nome];
    marcarRecusaDoServidor(controle, code, message);
  }

  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }
}
