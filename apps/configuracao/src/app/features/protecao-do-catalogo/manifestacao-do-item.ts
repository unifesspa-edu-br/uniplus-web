import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators, type AbstractControl } from '@angular/forms';
import { firstValueFrom, map, type Observable } from 'rxjs';
import { ProblemI18nService, type ApiResult, type ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  ProtecaoDoCatalogoApi,
  type CadastroDoCatalogo,
  type DetalheDaProtecaoDoCatalogoDto,
  type RegistrarManifestacaoDaProtecaoRequest,
  type ParecerDaManifestacao,
} from '@uniplus/shared-data/configuracao';
import { ateCaracteres, marcarRecusaDoServidor } from '../../shared/formulario';
import { ChaveDaIntencao, enviarComRetentativa } from './envio-da-protecao';
import {
  TEXTO_MAXIMO_DA_MANIFESTACAO,
  exigeTexto,
} from '../../shared/protecao-do-catalogo/manifestacoes';
import { ProtecaoDoCatalogoStore } from './protecao-do-catalogo.store';

const RAIZ = 'uniplus.configuracao.protecao_do_catalogo.';

/** O item mudou depois da leitura: de ciclo, ou foi decidido. A tela o relê e não reenvia sozinha. */
const RECUSAS_QUE_RELEEM_O_ITEM: ReadonlySet<string> = new Set([
  `${RAIZ}ciclo_mudou`,
  `${RAIZ}decisao_ja_tomada`,
]);
const FALHA_INESPERADA = 'Não foi possível registrar a manifestação. Tente de novo.';

/** O texto só de espaços conta como vazio: o parecer desfavorável não passa sem texto de verdade. */
function textoPreenchido(controle: AbstractControl<string>) {
  return controle.value.trim() === '' ? { required: true } : null;
}

/** Os campos do formulário da manifestação. */
type CampoDaManifestacao = 'parecer' | 'texto';

/**
 * A manifestação técnica do Encarregado de dados sobre a proteção proposta, no ciclo lido no
 * detalhe. A nova manifestação da mesma pessoa substitui a vigente. Se o ciclo mudou ou o item foi
 * decidido entre a leitura e o envio, o item é relido e a pessoa decide se registra de novo.
 */
@Injectable()
export class ManifestacaoDoItem {
  private readonly api = inject(ProtecaoDoCatalogoApi);
  private readonly store = inject(ProtecaoDoCatalogoStore);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  /** Uma chave por item: a resposta de um item não troca a chave de repetição do outro. */
  private readonly chaves = new Map<string, ChaveDaIntencao>();
  readonly form = new FormGroup({
    parecer: new FormControl<ParecerDaManifestacao | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    texto: new FormControl('', { nonNullable: true }),
  });
  /** Os itens com manifestação a caminho do servidor. */
  private readonly pendentes = signal<ReadonlySet<string>>(new Set());
  /** O item aberto, para recomeçar o formulário quando a pessoa passa a outro. */
  private readonly itemDoFormulario = signal<string | null>(null);
  /** O envio pendente de outro item não trava nem marca como ocupado o item aberto. */
  readonly enviando = computed(() => {
    const item = this.itemDoFormulario();
    return item !== null && this.pendentes().has(item);
  });
  readonly tentou = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  /** Cresce a cada manifestação registrada: o histórico se relê. */
  readonly registradas = signal(0);
  readonly textoObrigatorio = toSignal(
    this.form.controls.parecer.valueChanges.pipe(map(exigeTexto)),
    { initialValue: false },
  );

  constructor() {
    effect(() => {
      const id = this.store.detalhe()?.id ?? null;
      untracked(() => this.trocarDeItem(id));
    });
  }

  /** Outro item: parecer, texto, erros, avisos e a trava do envio do anterior não passam para ele. */
  private trocarDeItem(id: string | null): void {
    if (id === null || id === this.itemDoFormulario()) return;
    this.itemDoFormulario.set(id);
    this.form.reset();
    this.travarSeEnviando();
    this.tentou.set(false);
    this.erro.set(null);
    this.aviso.set(null);
  }

  /** A resposta que chega depois de a pessoa passar a outro item não mexe no formulário dele. */
  async enviar(detalhe: DetalheDaProtecaoDoCatalogoDto): Promise<void> {
    if (this.enviando() || !this.conferir()) return;
    const corpo = this.corpo(detalhe);
    this.marcarPendente(detalhe.id, true);
    const resultado = await firstValueFrom(this.gravar(corpo)).catch(() => null);
    this.marcarPendente(detalhe.id, false);
    if (resultado) this.chaveDo(detalhe.id).aposResposta(resultado);
    if (this.itemDoFormulario() !== detalhe.id) return;
    if (resultado) this.desfecho(resultado);
    else this.erro.set(FALHA_INESPERADA);
  }

  /**
   * Durante o envio o parecer e o texto do item ficam travados: o que se envia é o que está na
   * tela. Destrava antes do desfecho, que pode marcar nos campos a recusa do servidor.
   */
  private marcarPendente(item: string, pendente: boolean): void {
    this.pendentes.update((atuais) => {
      const novos = new Set(atuais);
      if (pendente) novos.add(item);
      else novos.delete(item);
      return novos;
    });
    this.travarSeEnviando();
  }

  private travarSeEnviando(): void {
    if (this.enviando()) this.form.disable();
    else this.form.enable();
  }

  private chaveDo(item: string): ChaveDaIntencao {
    const chave = this.chaves.get(item) ?? new ChaveDaIntencao();
    this.chaves.set(item, chave);
    return chave;
  }

  private gravar(corpo: RegistrarManifestacaoDaProtecaoRequest): Observable<ApiResult<void>> {
    return enviarComRetentativa(
      (contexto) => this.api.manifestar(corpo, contexto),
      this.chaveDo(corpo.itemId).para(corpo),
    );
  }

  /** O texto é obrigatório no parecer desfavorável e nunca passa do limite. */
  private conferir(): boolean {
    this.tentou.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    const texto = this.form.controls.texto;
    const obrigatorio = exigeTexto(this.form.controls.parecer.value);
    texto.setValidators([
      ...(obrigatorio ? [textoPreenchido] : []),
      ateCaracteres(TEXTO_MAXIMO_DA_MANIFESTACAO),
    ]);
    texto.updateValueAndValidity();
    this.form.markAllAsTouched();
    return !this.form.invalid;
  }

  private corpo(detalhe: DetalheDaProtecaoDoCatalogoDto): RegistrarManifestacaoDaProtecaoRequest {
    const { parecer, texto } = this.form.getRawValue();
    return {
      cadastro: detalhe.tipo as CadastroDoCatalogo,
      itemId: detalhe.id,
      ciclo: detalhe.aprovacao.ciclo,
      parecer: parecer as ParecerDaManifestacao,
      texto: texto.trim() === '' ? null : texto.trim(),
    };
  }

  private desfecho(resultado: ApiResult<void>): void {
    if (resultado.ok) this.concluir();
    else if (RECUSAS_QUE_RELEEM_O_ITEM.has(resultado.problem.code))
      this.relerOItem(resultado.problem);
    else if (!this.marcarCampos(resultado.problem)) this.erro.set(this.texto(resultado.problem));
  }

  private concluir(): void {
    this.form.reset();
    this.tentou.set(false);
    this.registradas.update((n) => n + 1);
    this.notificacoes.success('Manifestação registrada');
    this.store.recarregarDetalhe();
  }

  /** O item mudou depois da leitura: a tela relê e não reenvia sozinha, para a pessoa conferir antes. */
  private relerOItem(problema: ProblemDetails): void {
    this.aviso.set(
      `${this.texto(problema)} O item foi relido; confira a proposta e registre a manifestação de novo.`,
    );
    this.store.recarregarDetalhe();
  }

  private marcarCampos(problema: ProblemDetails): boolean {
    const doFormulario = (problema.errors ?? []).filter(
      (erro) => erro.field.toLowerCase() in this.form.controls,
    );
    for (const erro of doFormulario) {
      const campo = erro.field.toLowerCase() as CampoDaManifestacao;
      marcarRecusaDoServidor(this.form.controls[campo], erro.code, erro.message);
    }
    return doFormulario.length > 0;
  }

  private texto(problema: ProblemDetails): string {
    return this.problemas.resolve(problema).title;
  }
}
