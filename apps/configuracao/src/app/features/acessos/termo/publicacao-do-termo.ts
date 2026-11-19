import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ProblemI18nService, type ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  TermosDeResponsabilidadeApi,
  type PublicarVersaoDoTermoRequest,
  type VersaoDoTermoDto,
} from '@uniplus/shared-data/autorizacao';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../../shared/formulario';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { FALHA_INESPERADA } from '../mensagens-de-acesso';
import { ChavesPorComando } from '../versoes/chaves-por-comando';
import { PublicacaoDoTermoStore } from './publicacao-do-termo.store';

const RAIZ = 'uniplus.autorizacao.termo.';
const VIGENTE_ALTERADO = `${RAIZ}vigente_alterado`;

/** Os campos que o formulário de publicação tem. */
type CampoDaPublicacao = 'texto' | 'ato';

/** A recusa da API que fala de um campo, quando ela não vem com a lista de erros por campo. */
const CAMPO_DA_RECUSA: Readonly<Record<string, CampoDaPublicacao>> = {
  [`${RAIZ}texto_invalido`]: 'texto',
  [`${RAIZ}texto_igual_ao_vigente`]: 'texto',
  [`${RAIZ}ato_invalido`]: 'ato',
};

export const LIMITES_DO_TERMO = { textoMinimo: 200, textoMaximo: 20_000, atoMaximo: 500 } as const;

/**
 * A publicação de uma versão nova do termo, sobre a vigente que a tela leu. Se outra versão foi
 * publicada antes, a tela relê a vigente e o histórico e avisa; a recusa de campo fica no campo.
 */
@Injectable()
export class PublicacaoDoTermo {
  private readonly api = inject(TermosDeResponsabilidadeApi);
  private readonly store = inject(PublicacaoDoTermoStore);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly chaves = new ChavesPorComando();
  readonly publicando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);
  readonly form = new FormGroup({
    texto: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(LIMITES_DO_TERMO.textoMinimo),
        Validators.maxLength(LIMITES_DO_TERMO.textoMaximo),
      ],
    }),
    ato: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(LIMITES_DO_TERMO.atoMaximo)],
    }),
  });

  /** O aviso de outra versão publicada antes, que só sai quando a releitura da vigente termina bem. */
  private readonly avisoPendente = signal<string | null>(null);

  constructor() {
    effect(() => {
      const pendente = this.avisoPendente();
      if (pendente === null || !this.store.vigenteConhecida()) return;
      untracked(() => {
        this.aviso.set(pendente);
        this.avisoPendente.set(null);
      });
    });
  }

  async publicar(): Promise<void> {
    if (this.publicando() || !this.store.vigenteConhecida() || !this.conferir()) return;
    this.publicando.set(true);
    try {
      await this.enviar(this.corpo());
    } catch {
      this.erro.set(FALHA_INESPERADA);
    } finally {
      this.publicando.set(false);
    }
  }

  private conferir(): boolean {
    this.erro.set(null);
    descartarRecusasDoServidor(this.form);
    this.form.markAllAsTouched();
    return !this.form.invalid;
  }

  private corpo(): PublicarVersaoDoTermoRequest {
    const { texto, ato } = this.form.getRawValue();
    return { texto, ato: ato.trim(), versaoVigenteEsperadaId: this.store.vigente()?.id ?? null };
  }

  private async enviar(corpo: PublicarVersaoDoTermoRequest): Promise<void> {
    const { resultado } = await this.chaves.enviar('publicar', corpo, (contexto) =>
      this.api.publicar(corpo, contexto),
    );
    if (resultado.ok) this.concluir(resultado.data);
    else this.recusar(resultado.problem);
  }

  private concluir(versao: VersaoDoTermoDto): void {
    this.aviso.set(null);
    this.form.reset();
    this.notificacoes.success(`Versão ${versao.numero} do termo publicada`);
    this.store.recarregar();
  }

  private recusar(problema: ProblemDetails): void {
    if (problema.code === VIGENTE_ALTERADO) {
      this.aviso.set(null);
      this.store.recarregar();
      this.avisoPendente.set(this.texto(problema));
    } else if (!this.marcarCampos(problema)) {
      this.erro.set(this.texto(problema));
    }
  }

  /** Marca no campo a recusa por campo, ou a do código que só cabe a um campo. */
  private marcarCampos(problema: ProblemDetails): boolean {
    const campos = (problema.errors ?? []).filter(
      (e) => e.field.toLowerCase() in this.form.controls,
    );
    for (const erro of campos)
      this.marcar(erro.field.toLowerCase() as CampoDaPublicacao, erro.code, erro.message);
    const doCodigo = CAMPO_DA_RECUSA[problema.code];
    if (campos.length === 0 && doCodigo !== undefined)
      this.marcar(doCodigo, problema.code, this.texto(problema));
    return campos.length > 0 || doCodigo !== undefined;
  }

  private marcar(campo: CampoDaPublicacao, codigo: string, mensagem: string): void {
    marcarRecusaDoServidor(this.form.controls[campo], codigo, mensagem);
  }

  private texto(problema: ProblemDetails): string {
    return mensagemDaRecusa(this.problemas, this.notificacoes, problema);
  }
}
