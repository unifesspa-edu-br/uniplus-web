import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProblemI18nService, type ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import type { CategoriaDaRemocao, PerfilDto } from '@uniplus/shared-data/autorizacao';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../shared/formulario';
import { mensagemDaRecusa } from './falha-de-servidor';
import {
  CODIGO_NOME_DUPLICADO,
  controleDoCampoDoServidor,
  criarFormularioDePerfil,
  exigirCamposDaProposta,
  valoresDoPerfil,
} from './perfil-form';
import { CatalogoDePermissoesStore } from './versoes/catalogo-de-permissoes.store';
import {
  destinoDaProposta,
  diferencaDaVersao,
  type DestinoDaProposta,
} from './versoes/diferenca-da-versao';
import type { FaseDoEnvio } from './versoes/documento-da-versao.service';
import { EnvioDaVersao, type DesfechoDoEnvio, type PlanoDeEnvio } from './versoes/envio-da-versao';
import { EscritaDoPerfil } from './versoes/escrita-do-perfil';

const SEM_PERMISSAO = 'Marque ao menos uma permissão.';
const SEM_DOCUMENTO = 'Anexe o PDF do documento instituidor.';
const SEM_MUDANCA = 'Nada mudou. Altere o nome, a descrição ou as permissões para enviar.';
const DOCUMENTO_NAO_ENVIADO =
  'A versão foi registrada, mas o documento não foi enviado. Abra o perfil e envie o documento.';

const SUCESSO: Readonly<Record<PlanoDeEnvio['tipo'], string>> = {
  criacao: 'Perfil criado',
  proposta: 'Versão proposta',
  remocao: 'Permissões removidas',
};

/**
 * Estado e envio do formulário de perfil: o perfil novo e a proposta de versão de um perfil que
 * existe. As permissões acrescentadas e removidas aparecem em relação ao que está em vigor.
 */
@Injectable()
export class EdicaoDosPerfis {
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly envio = inject(EnvioDaVersao);
  private readonly catalogo = inject(CatalogoDePermissoesStore);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  /** Plano sem resposta definitiva (rede ou 5xx): a retentativa o repete igual, sob a mesma chave. */
  private planoPendente: PlanoDeEnvio | null = null;

  readonly form = criarFormularioDePerfil();
  readonly formAberto = signal(false);
  /** O perfil de que se propõe versão; `null` no perfil novo. */
  readonly base = signal<PerfilDto | null>(null);
  readonly marcadas = signal<ReadonlySet<string>>(new Set());
  readonly documento = signal<File | null>(null);
  readonly erroDoDocumento = signal<string | null>(null);
  readonly erroDasPermissoes = signal<string | null>(null);
  readonly erroDoForm = signal<string | null>(null);
  readonly fase = signal<FaseDoEnvio | null>(null);
  /** O envio ficou sem desfecho conhecido: os campos não mudam até repetir o mesmo envio. */
  readonly envioEmAberto = signal(false);

  private readonly valores = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  readonly emVigor = computed(
    () => this.base()?.composicaoEmVigor?.permissoes.map((p) => p.codigo) ?? [],
  );
  readonly diferenca = computed(() => diferencaDaVersao(this.emVigor(), this.marcadas()));
  private readonly textoMudou = computed(() => {
    const base = this.base();
    const { nome, descricao } = this.valores();
    return base === null || nome?.trim() !== base.nome || descricao?.trim() !== base.descricao;
  });
  readonly destino = computed(() =>
    this.base() === null ? 'versao' : destinoDaProposta(this.diferenca(), this.textoMudou()),
  );
  readonly exigeDocumento = computed(() => this.destino() === 'versao');
  readonly exigeRemocao = computed(
    () => this.base() !== null && this.diferenca().remocao.length > 0,
  );

  constructor() {
    effect(() =>
      exigirCamposDaProposta(this.form, {
        documento: this.exigeDocumento(),
        remocao: this.exigeRemocao(),
      }),
    );
  }

  abrirCriacao(): void {
    this.abrir(null);
  }

  abrirProposta(perfil: PerfilDto): void {
    this.abrir(perfil);
  }

  alternar(codigo: string): void {
    const proximas = new Set(this.marcadas());
    if (!proximas.delete(codigo)) proximas.add(codigo);
    this.marcadas.set(proximas);
    this.erroDasPermissoes.set(null);
  }

  aoEnviar(): void {
    if (!this.escrita.salvando()) void this.salvar();
  }

  async salvar(): Promise<void> {
    if (this.escrita.gravando()) return;
    this.erroDoForm.set(null);
    descartarRecusasDoServidor(this.form);
    const plano = this.planoPendente ?? this.planoValido();
    if (plano === null) return;
    await this.escrita.executar('salvando', () => this.enviar(plano), (m) => this.erroDoForm.set(m));
  }

  private abrir(base: PerfilDto | null): void {
    if (this.escrita.gravando()) return;
    this.escrita.erroDaAcao.set(null);
    this.planoPendente = null;
    this.envioEmAberto.set(false);
    this.base.set(base);
    this.form.reset(valoresDoPerfil(base));
    this.marcadas.set(new Set(base?.composicaoEmVigor?.permissoes.map((p) => p.codigo) ?? []));
    this.documento.set(null);
    this.limparErros();
    this.catalogo.carregar();
    this.formAberto.set(true);
  }

  private limparErros(): void {
    this.erroDoForm.set(null);
    this.erroDoDocumento.set(null);
    this.erroDasPermissoes.set(null);
  }

  private planoValido(): PlanoDeEnvio | null {
    const destino = this.destino();
    const arquivo = this.documento();
    const falhas = this.conferirCampos(destino, arquivo);
    if (this.form.invalid) this.form.markAllAsTouched();
    return falhas || this.form.invalid ? null : this.planoDe(destino, arquivo);
  }

  /** Aponta o que falta fora dos campos de texto; devolve se algo impede o envio. */
  private conferirCampos(destino: DestinoDaProposta, arquivo: File | null): boolean {
    const semMudanca = destino === 'nada';
    const semPermissao = destino === 'versao' && this.marcadas().size === 0;
    const semDocumento = this.exigeDocumento() && arquivo === null;
    this.erroDoForm.set(semMudanca ? SEM_MUDANCA : null);
    this.erroDasPermissoes.set(semPermissao ? SEM_PERMISSAO : null);
    this.erroDoDocumento.set(semDocumento ? SEM_DOCUMENTO : null);
    return semMudanca || semPermissao || semDocumento;
  }

  private planoDe(destino: DestinoDaProposta, arquivo: File | null): PlanoDeEnvio | null {
    const base = this.base();
    if (destino === 'remocao' && base !== null) {
      return {
        tipo: 'remocao',
        perfilId: base.id,
        corpo: { permissoes: [...this.diferenca().remocao], ...this.motivoDaRemocao() },
      };
    }
    if (arquivo === null) return null;
    const dados = this.dadosDaVersao(arquivo);
    return base === null
      ? { tipo: 'criacao', corpo: dados, arquivo }
      : {
          tipo: 'proposta',
          perfilId: base.id,
          corpo: { ...dados, ...this.remocaoDaProposta() },
          arquivo,
        };
  }

  private dadosDaVersao(arquivo: File) {
    const campos = this.form.getRawValue();
    return {
      nome: campos.nome.trim(),
      descricao: campos.descricao.trim(),
      permissoes: [...this.marcadas()].sort(),
      protocolo: campos.protocolo.trim(),
      tamanhoDoDocumento: arquivo.size,
    };
  }

  private motivoDaRemocao(): { motivo: string; categoria: CategoriaDaRemocao } {
    const { motivoDaRemocao, categoriaDaRemocao } = this.form.getRawValue();
    return { motivo: motivoDaRemocao.trim(), categoria: categoriaDaRemocao as CategoriaDaRemocao };
  }

  /** A proposta que retira permissão leva o motivo e a categoria; as demais, nenhum dos dois. */
  private remocaoDaProposta() {
    if (!this.exigeRemocao()) return { motivoDaRemocao: null, categoriaDaRemocao: null };
    const { motivo, categoria } = this.motivoDaRemocao();
    return { motivoDaRemocao: motivo, categoriaDaRemocao: categoria };
  }

  private async enviar(plano: PlanoDeEnvio): Promise<void> {
    try {
      const desfecho = await this.envio.executar(plano, (fase) => this.fase.set(fase));
      this.aplicar(desfecho, plano);
    } finally {
      this.fase.set(null);
    }
  }

  private aplicar(desfecho: DesfechoDoEnvio, plano: PlanoDeEnvio): void {
    if (desfecho.tipo === 'recusado') {
      this.recusar(desfecho.problema, desfecho.inconclusivo, plano);
      return;
    }
    this.planoPendente = null;
    this.envioEmAberto.set(false);
    this.formAberto.set(false);
    if (desfecho.tipo === 'sem_documento') {
      this.escrita.erroDaAcao.set(`${DOCUMENTO_NAO_ENVIADO} ${desfecho.mensagem}`);
    } else {
      this.notificacoes.success(SUCESSO[plano.tipo]);
    }
    this.escrita.recarregar();
  }

  private recusar(problema: ProblemDetails, inconclusivo: boolean, plano: PlanoDeEnvio): void {
    this.planoPendente = inconclusivo ? plano : null;
    this.envioEmAberto.set(inconclusivo);
    const motivo = this.texto(problema);
    if (!inconclusivo && this.aplicarErrosDeCampo(problema)) return;
    this.erroDoForm.set(
      inconclusivo ? `${motivo} ${INCONCLUSIVO[plano.tipo]}` : motivo,
    );
  }

  private texto(problema: ProblemDetails): string {
    return mensagemDaRecusa(this.problemas, this.notificacoes, problema);
  }

  /** Marca o campo recusado: o que o servidor aponta em `errors` e o nome já existente (409). */
  private aplicarErrosDeCampo(problema: ProblemDetails): boolean {
    let aplicado = problema.code === CODIGO_NOME_DUPLICADO;
    if (aplicado) this.marcar('nome', problema.code, this.texto(problema));
    for (const erro of problema.errors ?? []) {
      aplicado = this.aplicarErro(erro.field, erro.code, erro.message) || aplicado;
    }
    return aplicado;
  }

  private aplicarErro(campo: string, code: string, message: string): boolean {
    if (campo.toLowerCase() === 'permissoes') {
      this.erroDasPermissoes.set(message);
      return true;
    }
    const nome = controleDoCampoDoServidor(campo);
    if (nome === null) return false;
    this.marcar(nome, code, message);
    return true;
  }

  private marcar(nome: keyof ReturnType<typeof criarFormularioDePerfil>['controls'], code: string, message: string): void {
    marcarRecusaDoServidor(this.form.controls[nome], code, message);
  }
}

const INCONCLUSIVO: Readonly<Record<PlanoDeEnvio['tipo'], string>> = {
  criacao:
    'Não foi possível saber se o perfil foi criado. Confira a lista de perfis; se ele não aparecer, salve de novo: o envio é o mesmo e não se repete.',
  proposta:
    'Não foi possível saber se a versão foi registrada. Confira o perfil; se ela não aparecer, envie de novo: o envio é o mesmo e não se repete.',
  remocao:
    'Não foi possível saber se as permissões foram removidas. Confira o perfil; se elas continuarem, envie de novo: o envio é o mesmo e não se repete.',
};
