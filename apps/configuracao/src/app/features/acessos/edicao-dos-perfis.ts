import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  comChave,
  proximaChave,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PerfisApi, type PerfilDto } from '@uniplus/shared-data/autorizacao';
import { aguardarRecarga } from '../../shared/foco';
import { mensagemDaRecusa } from './falha-de-servidor';
import { FALHA_INESPERADA } from './mensagens-de-acesso';
import { PerfisStore } from './perfis.store';
import {
  CODIGO_NOME_DUPLICADO,
  controleDoCampoDoServidor,
  criarFormularioDePerfil,
  valoresDoPerfil,
} from './perfil-form';

interface CorpoDoPerfil {
  readonly nome: string;
  readonly descricao: string;
  readonly permissoes: string[];
}

/** Escritas e estado do formulário de perfis de acesso. */
@Injectable()
export class EdicaoDosPerfis {
  readonly store = inject(PerfisStore);
  private readonly api = inject(PerfisApi);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly chave = new ChaveDeSubstituicao();
  private chaveDaCriacao = idempotencyKey.create();
  /**
   * Corpo de uma criação sem resposta definitiva (rede ou 5xx): o servidor pode tê-la executado, então
   * a retentativa repete o mesmo corpo sob a mesma chave e recebe o replay em vez de um segundo perfil.
   */
  private corpoPendente: CorpoDoPerfil | null = null;
  readonly criacaoEmAberto = signal(false);

  readonly formAberto = signal(false);
  private readonly escrita = signal<'salvando' | 'ativando' | null>(null);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  readonly salvando = computed(() => this.escrita() === 'salvando');
  /** Inclui a espera pela recarga: a lista só volta a aceitar ação quando reflete o que foi gravado. */
  readonly gravando = computed(() => this.escrita() !== null || this.recarga.aguardando());
  readonly erroDoForm = signal<string | null>(null);
  readonly erroDaAcao = signal<string | null>(null);
  readonly emEdicao = signal<PerfilDto | null>(null);
  private readonly andamentoDaAtivacao = signal('');
  private readonly resultadoDaAtivacao = signal('');
  /** Na página: o andamento e o desfecho da mudança de situação, que não tem sobreposição para dizê-los. */
  readonly anuncioDaPagina = computed(
    () => this.andamentoDaAtivacao() || this.resultadoDaAtivacao(),
  );
  private readonly marcadas = signal<ReadonlySet<string>>(new Set());

  readonly form = criarFormularioDePerfil();

  marcada(codigo: string): boolean {
    return this.marcadas().has(codigo);
  }

  alternar(codigo: string): void {
    const proximas = new Set(this.marcadas());
    if (!proximas.delete(codigo)) proximas.add(codigo);
    this.marcadas.set(proximas);
  }

  abrirCriacao(): void {
    this.abrirForm(null);
  }

  abrirEdicao(perfil: PerfilDto): void {
    this.abrirForm(perfil);
  }

  aoEnviar(): void {
    if (!this.salvando()) void this.salvar();
  }

  async salvar(): Promise<void> {
    if (this.gravando()) return;
    this.erroDoForm.set(null);
    if (this.form.invalid && !this.criacaoEmAberto()) {
      this.form.markAllAsTouched();
      return;
    }
    this.escrita.set('salvando');

    const { nome, descricao } = this.form.getRawValue();
    const base: CorpoDoPerfil = this.corpoPendente ?? {
      nome: nome.trim(),
      descricao: descricao.trim(),
      permissoes: [...this.marcadas()],
    };
    const perfil = this.emEdicao();
    try {
      if (perfil === null) {
        await this.criar(base);
        return;
      }
      await this.atualizar(perfil, base);
    } catch {
      this.erroDoForm.set(FALHA_INESPERADA);
    } finally {
      this.escrita.set(null);
    }
  }

  async alternarAtivacao(perfil: PerfilDto): Promise<void> {
    if (this.gravando()) return;
    this.escrita.set('ativando');
    this.erroDaAcao.set(null);
    this.resultadoDaAtivacao.set('');
    this.andamentoDaAtivacao.set(
      `${perfil.ativo ? 'Desativando' : 'Reativando'} o perfil ${perfil.nome}.`,
    );
    try {
      const { resultado } = await comChave(
        this.chave,
        { id: perfil.id, ativo: !perfil.ativo },
        (contexto) =>
          perfil.ativo
            ? this.api.desativar(perfil.id, contexto)
            : this.api.ativar(perfil.id, contexto),
      );
      if (resultado.ok) this.concluirAtivacao(perfil);
      else this.erroDaAcao.set(this.texto(resultado.problem));
    } catch {
      this.erroDaAcao.set(FALHA_INESPERADA);
    } finally {
      this.andamentoDaAtivacao.set('');
      this.escrita.set(null);
    }
  }

  private concluirAtivacao(perfil: PerfilDto): void {
    this.notificacoes.success(perfil.ativo ? 'Perfil desativado' : 'Perfil reativado');
    this.resultadoDaAtivacao.set(
      `Perfil ${perfil.nome} ${perfil.ativo ? 'desativado' : 'reativado'}.`,
    );
    this.recarregar();
  }

  private async atualizar(perfil: PerfilDto, base: CorpoDoPerfil): Promise<void> {
    const { resultado } = await comChave<unknown>(
      this.chave,
      { id: perfil.id, ...base },
      (contexto) => this.api.atualizar(perfil.id, { id: perfil.id, ...base }, contexto),
    );
    if (!resultado.ok) {
      this.aplicarRecusa(resultado.problem);
      return;
    }
    this.formAberto.set(false);
    this.notificacoes.success('Perfil atualizado');
    this.recarregar();
  }

  private async criar(corpo: CorpoDoPerfil): Promise<void> {
    const resultado = await firstValueFrom(
      this.api.criar(corpo, withIdempotencyKey(this.chaveDaCriacao)),
    );
    if (!resultado.ok) {
      const anterior = this.chaveDaCriacao;
      this.chaveDaCriacao = proximaChave(anterior, resultado);
      const inconclusiva = this.chaveDaCriacao === anterior;
      this.corpoPendente = inconclusiva ? corpo : null;
      this.criacaoEmAberto.set(inconclusiva);
      const motivo = this.texto(resultado.problem);
      if (!inconclusiva && this.aplicarErrosDeCampo(resultado.problem)) return;
      this.erroDoForm.set(
        inconclusiva
          ? `${motivo} Não foi possível saber se o perfil foi criado. Confira a lista de perfis; se ele não aparecer, salve de novo: o envio é o mesmo e não se repete.`
          : motivo,
      );
      return;
    }
    this.reiniciarCriacao();
    this.formAberto.set(false);
    this.notificacoes.success('Perfil criado');
    this.recarregar();
  }

  private recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }

  private reiniciarCriacao(): void {
    this.chaveDaCriacao = idempotencyKey.create();
    this.corpoPendente = null;
    this.criacaoEmAberto.set(false);
  }

  private abrirForm(perfil: PerfilDto | null): void {
    if (this.gravando()) return;
    this.reiniciarCriacao();
    this.resultadoDaAtivacao.set('');
    this.emEdicao.set(perfil);
    this.erroDoForm.set(null);
    this.form.reset(valoresDoPerfil(perfil));
    this.marcadas.set(new Set(perfil?.permissoes.map((permissao) => permissao.codigo) ?? []));
    this.store.carregarCatalogo();
    this.formAberto.set(true);
  }

  private texto(problema: ProblemDetails): string {
    return mensagemDaRecusa(this.problemas, this.notificacoes, problema);
  }

  private aplicarRecusa(problema: ProblemDetails): void {
    if (!this.aplicarErrosDeCampo(problema)) this.erroDoForm.set(this.texto(problema));
  }

  /** Marca o campo recusado: o que o servidor aponta em `errors` e o nome já existente (409). */
  private aplicarErrosDeCampo(problema: ProblemDetails): boolean {
    let aplicado = false;
    if (problema.code === CODIGO_NOME_DUPLICADO) {
      this.marcar('nome', problema.code, this.texto(problema));
      aplicado = true;
    }
    for (const erro of problema.errors ?? []) {
      const nome = controleDoCampoDoServidor(erro.field);
      if (nome === null) continue;
      this.marcar(nome, erro.code, erro.message);
      aplicado = true;
    }
    return aplicado;
  }

  private marcar(nome: 'nome' | 'descricao', code: string, message: string): void {
    const controle = this.form.controls[nome];
    controle.setErrors({ backend: { code, message } });
    controle.markAsTouched();
  }
}
