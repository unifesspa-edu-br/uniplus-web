import {
  ElementRef,
  Injectable,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  comChave,
  proximaChave,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PerfisApi, type PerfilDto } from '@uniplus/shared-data/autorizacao';
import { FALHA_INESPERADA, textoDaRecusa } from './mensagens-de-acesso';
import { PerfisStore } from './perfis.store';
import { criarFormularioDePerfil, valoresDoPerfil } from './perfil-form';
import { controlNameFromBackendField, mensagemDeErroDoControle } from '../../shared/formulario';

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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
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
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly gravando = computed(() => this.escrita() !== null);
  readonly erroDoForm = signal<string | null>(null);
  readonly erroDaAcao = signal<string | null>(null);
  readonly emEdicao = signal<PerfilDto | null>(null);
  private readonly marcadas = signal<ReadonlySet<string>>(new Set());

  readonly form = criarFormularioDePerfil();

  invalido(nome: 'nome' | 'descricao'): boolean {
    const controle = this.form.controls[nome];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  mensagemDoCampo(nome: 'nome' | 'descricao'): string | null {
    if (this.form.controls[nome].hasError('required')) {
      return nome === 'nome' ? 'Informe o nome do perfil.' : 'Descreva o perfil.';
    }
    return mensagemDeErroDoControle(this.form.controls[nome]);
  }

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

  aoClicarEmSalvar(evento: Event): void {
    if (this.salvando()) evento.preventDefault();
  }

  aoEnviar(): void {
    if (!this.salvando()) void this.salvar();
  }

  async salvar(): Promise<void> {
    if (this.gravando()) return;
    this.erroDoForm.set(null);
    if (this.form.invalid && !this.criacaoEmAberto()) {
      this.form.markAllAsTouched();
      this.focarErro();
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
    try {
      const { resultado } = await comChave(
        this.chave,
        { id: perfil.id, ativo: !perfil.ativo },
        (contexto) =>
          perfil.ativo
            ? this.api.desativar(perfil.id, contexto)
            : this.api.ativar(perfil.id, contexto),
      );
      if (!resultado.ok) {
        this.erroDaAcao.set(this.texto(resultado.problem));
        return;
      }
      this.notificacoes.success(perfil.ativo ? 'Perfil desativado' : 'Perfil ativado');
      this.store.recarregar();
    } catch {
      this.erroDaAcao.set(FALHA_INESPERADA);
    } finally {
      this.escrita.set(null);
    }
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
    this.store.recarregar();
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
    this.emEdicao.set(perfil);
    this.erroDoForm.set(null);
    this.form.reset(valoresDoPerfil(perfil));
    this.marcadas.set(new Set(perfil?.permissoes.map((permissao) => permissao.codigo) ?? []));
    this.store.carregarCatalogo();
    this.formAberto.set(true);
  }

  private texto(problema: Parameters<ProblemI18nService['resolve']>[0]): string {
    return textoDaRecusa(this.problemas.resolve(problema));
  }

  private aplicarRecusa(problema: Parameters<ProblemI18nService['resolve']>[0]): void {
    if (!this.aplicarErrosDeCampo(problema)) this.erroDoForm.set(this.texto(problema));
  }

  private aplicarErrosDeCampo(problema: Parameters<ProblemI18nService['resolve']>[0]): boolean {
    let aplicado = false;
    for (const erro of problema.errors ?? []) {
      const nome = controlNameFromBackendField<'nome' | 'descricao'>(
        erro.field,
        new Set(['nome', 'descricao']),
      );
      if (nome === null) continue;
      const controle = this.form.controls[nome];
      controle.setErrors({ backend: { code: erro.code, message: erro.message } });
      controle.markAsTouched();
      aplicado = true;
    }
    if (aplicado) this.focarErro();
    return aplicado;
  }

  private focarErro(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      { injector: this.injector },
    );
  }
}
