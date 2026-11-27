import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Injectable, Injector, NgZone } from '@angular/core';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import { antecedenciaEfetivaEmSegundos, type PrazoDoAcesso } from '../models/prazo-da-credencial';
import { AUTH_CONFIG } from '../tokens/auth.tokens';
import { AtividadeDaPessoa } from './atividade-da-pessoa.service';
import { AuthService } from './auth.service';

/** Depois do prazo da sessão, para a tentativa chegar quando o provedor já a considera vencida. */
const MARGEM_APOS_O_PRAZO_DA_SESSAO_MS = 1000;
/** Pede ao cliente de login que renove mesmo com o acesso ainda válido. */
const RENOVAR_SEMPRE = -1;
const MILISSEGUNDOS_POR_SEGUNDO = 1000;
/** Espera antes de tentar de novo quando a renovação não renovou nada. */
const ESPERA_PARA_TENTAR_DE_NOVO_MS = 15 * MILISSEGUNDOS_POR_SEGUNDO;

/**
 * Renova o acesso antes de vencer, enquanto a pessoa usa a aplicação. A hora de agir vem dos
 * prazos que o login informou e da antecedência configurada; o temporizador é só um lembrete, e a
 * decisão é sempre tomada pela hora atual, porque o navegador atrasa temporizadores de aba oculta
 * e computador suspenso não os conta. Sem atividade da pessoa, espera a próxima ação, para a aba
 * parada deixar a sessão vencer pela ociosidade. O fim da sessão não é decidido aqui: depois do
 * prazo dela, uma tentativa de renovação recebe a recusa do provedor, e é essa recusa que a encerra.
 */
@Injectable({ providedIn: 'root' })
export class RenovacaoDoAcesso {
  private readonly auth = inject(AuthService);
  private readonly atividade = inject(AtividadeDaPessoa);
  private readonly relogio = inject(RELOGIO);
  private readonly injector = inject(Injector);
  private readonly documento = inject(DOCUMENT);
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private esperandoAPessoa = false;

  constructor() {
    effect(() => {
      this.auth.prazoDoAcesso();
      this.auth.prazoDaCredencial();
      this.avaliar();
    });
    const pararDeOuvir = inject(NgZone).runOutsideAngular(() => this.ouvirOsRetornos());
    inject(DestroyRef).onDestroy(() => {
      pararDeOuvir();
      this.cancelar();
    });
  }

  /** Reavalia quando a pessoa volta à aba ou a rede volta. Devolve a função que desliga os ouvintes. */
  private ouvirOsRetornos(): () => void {
    const janela = this.documento.defaultView;
    const aoVoltar = () => this.avaliar();
    const aoMostrar = () => {
      if (this.documento.visibilityState === 'visible') this.avaliar();
    };
    janela?.addEventListener('online', aoVoltar);
    janela?.addEventListener('pageshow', aoVoltar);
    this.documento.addEventListener('visibilitychange', aoMostrar);
    return () => {
      janela?.removeEventListener('online', aoVoltar);
      janela?.removeEventListener('pageshow', aoVoltar);
      this.documento.removeEventListener('visibilitychange', aoMostrar);
    };
  }

  private avaliar(): void {
    this.cancelar();
    const acesso = this.auth.prazoDoAcesso();
    if (acesso === null) return;
    const agora = this.relogio().getTime();
    const fimDaSessao = this.fimDaSessao();
    if (fimDaSessao !== null && agora >= fimDaSessao) {
      void this.renovar(RENOVAR_SEMPRE);
    } else {
      this.agirSobreOAcesso(acesso, agora, fimDaSessao);
    }
  }

  private agirSobreOAcesso(acesso: PrazoDoAcesso, agora: number, fimDaSessao: number | null): void {
    const antecedencia = this.antecedenciaEmMs(acesso);
    const horaDeRenovar = acesso.venceEm - antecedencia;
    if (agora >= horaDeRenovar) {
      this.renovarSeHouveAtividade(acesso.emitidoEm, antecedencia);
      return;
    }
    this.lembrarEm(Math.min(horaDeRenovar, fimDaSessao ?? Infinity) - agora);
  }

  private fimDaSessao(): number | null {
    const sessao = this.auth.prazoDaCredencial();
    return sessao === null ? null : sessao.venceEm + MARGEM_APOS_O_PRAZO_DA_SESSAO_MS;
  }

  private lembrarEm(esperaEmMs: number): void {
    this.temporizador = setTimeout(() => this.avaliar(), esperaEmMs);
  }

  private renovarSeHouveAtividade(emitidoEm: number, antecedenciaEmMs: number): void {
    const antecedenciaEmSegundos = antecedenciaEmMs / MILISSEGUNDOS_POR_SEGUNDO;
    if (this.atividade.houveDesde(emitidoEm)) {
      void this.renovar(antecedenciaEmSegundos);
      return;
    }
    this.esperarAProximaAcao();
  }

  /**
   * Sem atividade, nada renova; a aba parada deixa a sessão vencer. Mas o fim dela não pode
   * depender de a pessoa voltar: no prazo, uma tentativa recebe a recusa do provedor e a encerra.
   * Basta uma espera pendente pela próxima ação, por mais que se reavalie.
   */
  private esperarAProximaAcao(): void {
    const fimDaSessao = this.fimDaSessao();
    if (fimDaSessao !== null) this.lembrarEm(fimDaSessao - this.relogio().getTime());
    if (this.esperandoAPessoa) return;
    this.esperandoAPessoa = true;
    void this.atividade.proxima().then(() => {
      this.esperandoAPessoa = false;
      this.avaliar();
    });
  }

  /**
   * O acesso para anexar a um pedido. Renova antes, se está para vencer, só quando a pessoa agiu
   * desde que ele foi emitido: pedido automático, como o de uma tela que consulta sozinha, não
   * adia a sessão. Sem a hora de emissão não há como saber, e vale renovar.
   */
  async acessoParaOPedido(): Promise<string | undefined> {
    if (this.auth.getToken() === undefined) return undefined;
    const acesso = this.auth.prazoDoAcesso();
    const antecedencia = this.antecedenciaEmSegundos(acesso);
    const pessoaAgiu = acesso === null || this.atividade.houveDesde(acesso.emitidoEm);
    if (pessoaAgiu && this.auth.isTokenExpired(antecedencia)) {
      await this.auth.refreshToken(antecedencia);
    }
    return this.auth.getToken();
  }

  /**
   * Quando a renovação devolve falso, o acesso não mudou: ou o cliente de login não renovou por
   * estar no limite exato, ou a falha foi passageira. Sem prazo novo nada reagenda sozinho, então
   * tenta de novo depois de uma espera; se a sessão tiver acabado, a tentativa recebe a recusa e a
   * encerra.
   */
  private async renovar(minimaEmSegundos: number): Promise<void> {
    const renovou = await this.auth.refreshToken(minimaEmSegundos);
    if (!renovou && this.auth.prazoDoAcesso() !== null) {
      this.lembrarEm(ESPERA_PARA_TENTAR_DE_NOVO_MS);
    }
  }

  private antecedenciaEmMs(acesso: PrazoDoAcesso): number {
    return this.antecedenciaEmSegundos(acesso) * MILISSEGUNDOS_POR_SEGUNDO;
  }

  private antecedenciaEmSegundos(acesso: PrazoDoAcesso | null): number {
    const configurada = this.injector.get(AUTH_CONFIG).antecedenciaDaRenovacaoEmSegundos;
    return antecedenciaEfetivaEmSegundos(configurada, acesso);
  }

  private cancelar(): void {
    if (this.temporizador !== null) clearTimeout(this.temporizador);
    this.temporizador = null;
  }
}
