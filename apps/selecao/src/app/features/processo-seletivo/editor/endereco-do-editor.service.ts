import { effect, inject, untracked, DestroyRef, computed, Injectable } from '@angular/core';
import type { Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { ProcessoSeletivoStore } from '../wizard/processo-seletivo.store';
import { temAtoDigitado } from '../wizard/shared/ato-digitado';
import {
  AVISO_DE_ATO_DIGITADO,
  ConfirmacaoDeSaida,
} from '../wizard/shared/saida-com-ato-digitado.guard';
import { LeituraDoProcesso } from './leitura-do-processo.service';

@Injectable()
export class EnderecoDoEditor {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly leitura = inject(LeituraDoProcesso);
  private readonly confirmacaoDeSaida = inject(ConfirmacaoDeSaida);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Há ato digitado que sair da página descarta. Só some quando o servidor confirma que o processo
   * saiu do rascunho: o que sobra em tela é então o ato que já virou publicação. Enquanto o
   * resultado da publicação é desconhecido, a edição fica bloqueada mas o processo pode ainda estar
   * em rascunho, e o ato digitado continua a perder.
   */
  readonly atoDigitadoPendente: Signal<boolean> = computed(
    () => !this.store.processoForaDeRascunho() && temAtoDigitado(this.store.draft().publicacao),
  );

  /** Deve ser chamado no construtor da página: os efeitos e a assinatura seguem o ciclo de vida dela. */
  acompanhar(): void {
    this.darEnderecoAoProcessoCriado();
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.aoMudarOEndereco(params.get('id')));
  }

  /** Repete a leitura do endereço atual, para as falhas que admitem retentativa. */
  tentarNovamente(): boolean {
    const id = this.route.snapshot.paramMap.get('id');
    if (id === null || this.store.hidratando()) return false;
    void this.leitura.retomar(id);
    return true;
  }

  /**
   * Assim que a criação — disparada dentro do passo 2 — devolve o id, o endereço passa a
   * contê-lo. Sem isto, recarregar `/novo` depois de já ter criado perderia o vínculo, e o passo 2
   * dispararia um segundo POST para o mesmo rascunho.
   *
   * A transição preserva esta instância: as duas rotas do editor declaram a mesma `reuseKey` (ver
   * `editor-route-reuse.strategy.ts`). Sem isso o wizard voltaria ao passo 1 no meio do anexo do
   * edital, que é quando a criação responde. `replaceUrl` porque não é navegação nova — é o mesmo
   * cadastro ganhando endereço próprio.
   */
  private darEnderecoAoProcessoCriado(): void {
    effect(() => {
      const id = this.store.processoSeletivoId();
      if (id === null) return;
      untracked(() => {
        if (this.route.snapshot.paramMap.get('id') !== null) return;
        void this.router.navigate(['/processo-seletivo', id], { replaceUrl: true });
      });
    });
  }

  /**
   * Reage ao parâmetro, e não o lê uma vez: com a rota reusada o construtor não roda de novo, então
   * abrir outro processo pelo endereço precisa disparar a leitura aqui. O id assumido logo após a
   * criação não relê nada — o editor já tem o que acabou de gravar.
   */
  private aoMudarOEndereco(id: string | null): void {
    if (id === null) {
      this.aoEntrarEmProcessoNovo();
    } else if (id === this.store.processoSeletivoId()) {
      this.aoVoltarAoProcessoEmTela(id);
    } else if (this.podeTrocarDeProcesso()) {
      void this.leitura.retomar(id);
    } else {
      // A guarda da rota não roda aqui: mudar só o `:id` reusa a rota, e o componente nunca é
      // desativado. Sem perguntar neste ponto, a promessa dela valia para sair do editor e não
      // para trocar de processo — e é `retomar()` quem apaga o ato digitado, logo em seguida.
      this.voltarAoProcessoAberto();
    }
  }

  /**
   * Entrar em `/novo` com a página reusada de um processo já carregado deixaria o cadastro anterior
   * em tela sob o endereço de cadastro novo — com os campos congelados e o id de outro processo no
   * store, o que o operador continuasse preenchendo iria para o processo errado.
   *
   * `hidratando` entra na conta: uma leitura ainda em voo não deixou rastro nos outros dois
   * sinais, e sua resposta hidrataria o processo sob `/novo` — o efeito do id levaria de volta a
   * ele em seguida.
   */
  private aoEntrarEmProcessoNovo(): void {
    const tinhaProcesso =
      this.store.processoSeletivoId() !== null ||
      this.store.falhaDeLeitura() !== null ||
      this.store.hidratando();
    if (!tinhaProcesso) return;

    if (!this.podeTrocarDeProcesso()) {
      this.voltarAoProcessoAberto();
      return;
    }
    this.leitura.abandonar();
  }

  /**
   * Voltar ao processo que já está em tela não relê nada — exceto quando a ida a outro endereço
   * interrompeu a leitura no meio. Aí o que ficou é um estado parcial: o detalhe hidratou, a
   * resposta dos documentos foi descartada, e o editor não sabe se existe edital. Ler de novo é
   * mais seguro do que consertar sinal por sinal — foi remendando esses sinais que se chegou a um
   * anexo destravado sobre estado desconhecido.
   */
  private aoVoltarAoProcessoEmTela(id: string): void {
    if (this.store.falhaDeLeitura() !== null || this.store.hidratando()) {
      void this.leitura.retomar(id);
    }
  }

  /** Há ato digitado, e quem está trocando de processo concordou em perdê-lo? */
  private podeTrocarDeProcesso(): boolean {
    if (!this.atoDigitadoPendente()) return true;
    return this.confirmacaoDeSaida.confirmar(AVISO_DE_ATO_DIGITADO);
  }

  /**
   * Devolve o endereço ao processo que continua em tela.
   *
   * A assinatura do parâmetro dispara de novo, e o ramo que reconhece o processo já aberto não
   * relê nada — é por isso que voltar aqui não custa o ato digitado que a recusa acabou de
   * proteger.
   */
  private voltarAoProcessoAberto(): void {
    const aberto = this.store.processoSeletivoId();

    // Sem processo aberto, o editor está no cadastro novo: é para lá que o endereço volta.
    // Deixá-lo no `:id` recusado punha o cadastro em andamento sob o endereço de outro
    // processo — e, ao criar, o efeito que ajusta a URL desistiria, porque ela já traz um id.
    void this.router.navigate(
      aberto === null ? ['/processo-seletivo', 'novo'] : ['/processo-seletivo', aberto],
      { replaceUrl: true },
    );
  }
}
