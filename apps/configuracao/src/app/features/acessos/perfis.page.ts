import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  comChave,
  lookupCompleto,
  proximaChave,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PerfisApi, type PerfilDto } from '@uniplus/shared-data/autorizacao';
import {
  AlertComponent,
  DrawerComponent,
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { FALHA_INESPERADA, textoDaRecusa } from './mensagens-de-acesso';
import { PaginaPorCursor } from './pagina-por-cursor';
import { sensibilidade } from './rotulos-de-acesso';

interface CorpoDoPerfil {
  readonly nome: string;
  readonly descricao: string;
  readonly permissoes: string[];
}

/** Perfis de acesso: lista, criação, edição do perfil comum e ativação. */
@Component({
  selector: 'cfg-perfis-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DrawerComponent,
    EmptyStateComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  template: `
    <div class="page-header">
      <div class="page-header__content">
        <h1 class="page-header__title">Perfis de acesso</h1>
        <p class="page-header__desc">
          Conjuntos nomeados de permissões. Mudar um perfil vale para todas as concessões dele.
        </p>
      </div>
      <div class="page-header__actions">
        <button type="button" class="btn btn--primary" (click)="abrirCriacao()">Novo perfil</button>
      </div>
    </div>

    @if (mensagemDeErro(); as mensagem) {
      <ui-alert variant="danger" heading="Não foi possível carregar os perfis">
        {{ mensagem }}
        <div>
          <button type="button" class="btn btn--secondary btn--sm" (click)="pagina.carregar()">
            Tentar novamente
          </button>
        </div>
      </ui-alert>
    }
    @if (erroDaAcao()) {
      <ui-alert variant="danger" heading="Não foi possível concluir">{{ erroDaAcao() }}</ui-alert>
    }

    <section
      class="panel"
      aria-labelledby="cfg-perfis-titulo"
      [attr.aria-busy]="pagina.carregando()"
    >
      <div class="panel-head">
        <div class="panel-head__title">
          <h2 id="cfg-perfis-titulo">Perfis</h2>
          @if (pagina.carregando()) {
            <span><ui-spinner size="sm" /> Carregando</span>
          }
        </div>
      </div>

      @if (pagina.itens().length > 0) {
        <div class="table-responsive">
          <table>
            <caption class="sr-only">
              Perfis de acesso
            </caption>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Permissões</th>
                <th scope="col">Sensibilidade</th>
                <th scope="col">Situação</th>
                <th scope="col"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              @for (perfil of pagina.itens(); track perfil.id) {
                <tr>
                  <td data-label="Nome">
                    {{ perfil.nome }}
                    @if (perfil.governanca) {
                      <ui-tag variant="info">Governança</ui-tag>
                    }
                    <br /><small>{{ perfil.descricao }}</small>
                  </td>
                  <td data-label="Permissões">{{ perfil.permissoes.length }}</td>
                  <td data-label="Sensibilidade">{{ sensibilidadeDe(perfil.sensibilidade) }}</td>
                  <td data-label="Situação">
                    <ui-tag [variant]="perfil.ativo ? 'success' : 'neutral'">{{
                      perfil.ativo ? 'Ativo' : 'Desativado'
                    }}</ui-tag>
                  </td>
                  <td class="table-responsive__actions" data-label="Ações">
                    @if (!perfil.governanca) {
                      <ui-icon-button
                        icon="pi-pencil"
                        [accessibleName]="'Editar o perfil ' + perfil.nome"
                        tooltip="Editar perfil"
                        (triggered)="abrirEdicao(perfil)"
                      />
                      <ui-icon-button
                        icon="pi-power-off"
                        [accessibleName]="
                          (perfil.ativo ? 'Desativar' : 'Ativar') + ' o perfil ' + perfil.nome
                        "
                        [tooltip]="perfil.ativo ? 'Desativar perfil' : 'Ativar perfil'"
                        (triggered)="alternarAtivacao(perfil)"
                      />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!pagina.carregando() && !mensagemDeErro()) {
        <ui-empty-state heading="Nenhum perfil" description="Crie o primeiro perfil de acesso." />
      }

      @if (pagina.anterior() !== null || pagina.proximo() !== null) {
        <ui-pager
          statusText="Navegação por páginas"
          navigationLabel="Paginação de perfis"
          [hasPrevious]="pagina.anterior() !== null"
          [hasNext]="pagina.proximo() !== null"
          [isDisabled]="pagina.carregando()"
          (previous)="pagina.voltar()"
          (next)="pagina.proxima()"
        />
      }
    </section>

    <ui-drawer
      class="cfg-form-drawer"
      [(visible)]="formAberto"
      [heading]="emEdicao() ? 'Editar perfil' : 'Novo perfil'"
      ariaLabel="Formulário de perfil de acesso"
      position="right"
    >
      @if (erroDoForm()) {
        <ui-alert variant="danger" heading="Não foi possível salvar">{{ erroDoForm() }}</ui-alert>
      }
      <form
        id="cfg-perfil-form"
        class="cfg-form"
        [formGroup]="form"
        (ngSubmit)="salvar()"
        novalidate
      >
        <label class="field" [class.is-error]="invalido('nome')">
          <span class="field__label is-required">Nome</span>
          <input
            class="input"
            type="text"
            formControlName="nome"
            [attr.aria-invalid]="invalido('nome') ? 'true' : null"
          />
          @if (invalido('nome')) {
            <span class="field__error">Informe o nome do perfil.</span>
          }
        </label>
        <label class="field" [class.is-error]="invalido('descricao')">
          <span class="field__label is-required">Descrição</span>
          <textarea
            class="textarea"
            formControlName="descricao"
            [attr.aria-invalid]="invalido('descricao') ? 'true' : null"
          ></textarea>
          @if (invalido('descricao')) {
            <span class="field__error">Descreva o perfil.</span>
          }
        </label>

        <fieldset class="field">
          <legend class="field__label">Permissões</legend>
          @if (catalogo.comErro()) {
            <ui-alert variant="warning" heading="Catálogo indisponível">
              Não foi possível carregar o catálogo de permissões.
              <button
                type="button"
                class="btn btn--secondary btn--sm"
                (click)="catalogo.recarregar()"
              >
                Tentar novamente
              </button>
            </ui-alert>
          }
          @for (modulo of catalogo.opcoes(); track modulo.modulo) {
            @for (recurso of modulo.recursos; track recurso.recurso) {
              <fieldset class="field">
                <legend class="field__label">{{ modulo.modulo }} · {{ recurso.recurso }}</legend>
                @for (permissao of recurso.permissoes; track permissao.codigo) {
                  <label class="checkbox">
                    <input
                      type="checkbox"
                      [checked]="marcada(permissao.codigo)"
                      [disabled]="criacaoEmAberto()"
                      (change)="alternar(permissao.codigo)"
                    />
                    <span class="checkbox__box" aria-hidden="true"></span>
                    <span>
                      {{ permissao.nome }}
                      <small>
                        · {{ sensibilidadeDe(permissao.sensibilidade) }} ·
                        <code>{{ permissao.codigo }}</code>
                      </small>
                    </span>
                  </label>
                }
              </fieldset>
            }
          }
          <span class="field__hint"
            >Permissão de dado pessoal ou sensível exige a aprovação da encarregada nos pedidos
            deste perfil.</span
          >
        </fieldset>
      </form>
      <div class="cfg-form-footer">
        <button type="button" class="btn btn--tertiary btn--rect" (click)="formAberto.set(false)">
          Cancelar
        </button>
        <button
          type="submit"
          form="cfg-perfil-form"
          class="btn btn--primary"
          [disabled]="salvando()"
        >
          @if (salvando()) {
            <ui-spinner size="sm" />
          }
          {{ salvando() ? 'Salvando…' : 'Salvar perfil' }}
        </button>
      </div>
    </ui-drawer>
  `,
})
export class PerfisPage implements OnInit {
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
  protected readonly criacaoEmAberto = signal(false);

  protected readonly pagina = new PaginaPorCursor(
    (pagina) => this.api.listar({ cursor: pagina?.cursor, direction: pagina?.direction }),
    inject(DestroyRef),
  );
  protected readonly catalogo = lookupCompleto(
    () => this.api.catalogoDePermissoes(),
    inject(DestroyRef),
  );

  protected readonly formAberto = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erroDoForm = signal<string | null>(null);
  protected readonly erroDaAcao = signal<string | null>(null);
  protected readonly emEdicao = signal<PerfilDto | null>(null);
  private readonly marcadas = signal<ReadonlySet<string>>(new Set());

  protected readonly form = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly mensagemDeErro = computed(() => {
    const problema = this.pagina.problema();
    return problema === null ? null : this.texto(problema);
  });

  protected readonly sensibilidadeDe = sensibilidade;

  ngOnInit(): void {
    this.pagina.carregar();
  }

  protected invalido(nome: 'nome' | 'descricao'): boolean {
    const controle = this.form.controls[nome];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  protected marcada(codigo: string): boolean {
    return this.marcadas().has(codigo);
  }

  protected alternar(codigo: string): void {
    const proximas = new Set(this.marcadas());
    if (!proximas.delete(codigo)) proximas.add(codigo);
    this.marcadas.set(proximas);
  }

  protected abrirCriacao(): void {
    this.abrirForm(null);
  }

  protected abrirEdicao(perfil: PerfilDto): void {
    this.abrirForm(perfil);
  }

  protected async salvar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.salvando()) return;
    this.salvando.set(true);
    this.erroDoForm.set(null);

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
      const { resultado } = await comChave<unknown>(
        this.chave,
        { id: perfil.id, ...base },
        (contexto) => this.api.atualizar(perfil.id, { id: perfil.id, ...base }, contexto),
      );
      if (!resultado.ok) {
        this.erroDoForm.set(this.texto(resultado.problem));
        return;
      }
      this.formAberto.set(false);
      this.notificacoes.success('Perfil atualizado');
      this.pagina.carregar();
    } catch {
      this.erroDoForm.set(FALHA_INESPERADA);
    } finally {
      this.salvando.set(false);
    }
  }

  protected async alternarAtivacao(perfil: PerfilDto): Promise<void> {
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
      this.pagina.carregar();
    } catch {
      this.erroDaAcao.set(FALHA_INESPERADA);
    }
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
      if (inconclusiva) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
      const motivo = this.texto(resultado.problem);
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
    this.pagina.carregar();
  }

  private reiniciarCriacao(): void {
    this.chaveDaCriacao = idempotencyKey.create();
    this.corpoPendente = null;
    this.criacaoEmAberto.set(false);
    this.form.enable({ emitEvent: false });
  }

  private abrirForm(perfil: PerfilDto | null): void {
    this.reiniciarCriacao();
    this.emEdicao.set(perfil);
    this.erroDoForm.set(null);
    this.form.reset({ nome: perfil?.nome ?? '', descricao: perfil?.descricao ?? '' });
    this.marcadas.set(new Set(perfil?.permissoes.map((permissao) => permissao.codigo) ?? []));
    this.catalogo.recarregar();
    this.formAberto.set(true);
  }

  private texto(problema: Parameters<ProblemI18nService['resolve']>[0]): string {
    return textoDaRecusa(this.problemas.resolve(problema));
  }
}
