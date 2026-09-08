import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RegraCatalogoDto } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  MatrizDaRegra,
  matrizDaRegra,
  ofertasComCascataForaDoRegimeFederal,
  precisaExibirSecaoDaCascata,
  ProblemaDaCascata,
  problemasDaCascata,
} from './cascata-de-remanejamento';
import { CatalogosDeDistribuicaoService } from './catalogos-de-distribuicao.service';
import { explicarRegra, RegraExplicada } from './regra-em-linguagem-clara';

/**
 * A seção da cascata de remanejamento, dentro do passo Vagas (UNI-REQ-0134,
 * RN-CASCATA-1..5).
 *
 * Não é passo próprio do wizard: a cascata é função das ofertas que o
 * operador acabou de montar na mesma tela, e só existe uma decisão por
 * processo. `VagasStepComponent` lê este componente por `viewChild` para
 * validar e gravar — a cascata é gravada no `persistir()` do passo Vagas,
 * depois da distribuição, porque referencia modalidades que só existem
 * depois de a oferta ser gravada (CA-06).
 *
 * **A tela confirma, não compõe.** O operador escolhe regra e versão; o
 * `fallbackCodigo` e os `destinos[]` são derivados do `esquemaArgs`
 * congelado da regra — nunca compostos aqui. O handler recusa com
 * `MatrizDivergenteDaRegra` qualquer divergência célula a célula
 * (RN-CASCATA-5).
 */
@Component({
  selector: 'sel-cascata-remanejamento',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './cascata-remanejamento.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CascataRemanejamentoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeDistribuicaoService);

  private readonly ofertas = computed(() => this.store.draft().vagas.ofertas);
  readonly cascata = computed(() => this.store.draft().vagas.cascata);

  /**
   * A seção só aparece quando há ao menos uma oferta federal com modalidade
   * `SEGUE_CASCATA` (`PendenciaDaCascata`/`ExisteCascataForaDoRegimeFederal`
   * do agregado). Fora disso, nada aqui fecha pendência nenhuma.
   */
  readonly precisaExibir = computed(() =>
    precisaExibirSecaoDaCascata(this.ofertas(), this.catalogos.modalidadePorId()),
  );

  /**
   * Ofertas que exigiriam cascata mas usam regra de distribuição fora do
   * ramo federal — item `cascata_modalidade_fora_do_regime_federal`. A
   * correção é no quadro de vagas acima, nunca aqui.
   */
  readonly ofertasForaDoRegime = computed(() =>
    ofertasComCascataForaDoRegimeFederal(this.ofertas(), this.catalogos.modalidadePorId()),
  );

  /** `"codigo|versao"`, ou `"|"` enquanto não há escolha — mesmo molde do seletor de regra da distribuição. */
  readonly valorDoSelect = computed(() => {
    const selecao = this.cascata();
    return selecao === null ? '|' : `${selecao.regraCodigo}|${selecao.regraVersao}`;
  });

  /**
   * Controle reativo e tipado do seletor de regra (AGENTS.md: "formulários
   * reativos tipados"). `valorDoSelect()` continua sendo a fonte de verdade —
   * o rascunho é quem decide o que está selecionado, inclusive depois de
   * hidratação ou troca de processo —, e um `effect` mantém o controle em
   * sincronia sem realimentar o próprio evento (`emitEvent: false`); o
   * `valueChanges` é o único caminho de volta para `escolherRegra`.
   */
  readonly regraControl = new FormControl<string>('|', { nonNullable: true });

  private readonly regraEscolhida = computed<RegraCatalogoDto | undefined>(() => {
    const selecao = this.cascata();
    if (selecao === null) return undefined;
    return this.catalogos
      .regrasCascata()
      .find((regra) => regra.codigo === selecao.regraCodigo && regra.versao === selecao.regraVersao);
  });

  readonly regraExplicada = computed<RegraExplicada | null>(() =>
    explicarRegra(this.regraEscolhida()),
  );

  /** A matriz que a regra escolhida congela — o que a tela apresenta e envia, sem editar. */
  readonly matriz = computed<MatrizDaRegra | null>(() => {
    const regra = this.regraEscolhida();
    return regra === undefined ? null : matrizDaRegra(regra.esquemaArgs);
  });

  /** A regra existe no catálogo mas o `esquemaArgs` não tem a forma reconhecida — defeito a reportar, não matriz vazia. */
  readonly esquemaNaoReconhecido = computed(
    () => this.regraEscolhida() !== undefined && this.matriz() === null,
  );

  /** Encaixe entre a matriz e cada oferta federal — por oferta, nunca sobre a união (RN-CASCATA-1/2/2b). */
  readonly problemas = computed<readonly ProblemaDaCascata[]>(() => {
    const matriz = this.matriz();
    if (matriz === null) return [];
    return problemasDaCascata(this.ofertas(), this.catalogos.modalidadePorId(), matriz);
  });

  /** Confirmação transitiva de UI — não é campo do rascunho, some a cada escolha de regra nova. */
  readonly confirmado = signal(false);

  /**
   * O servidor pode ter uma cascata gravada — de hidratação ou de uma
   * gravação anterior nesta mesma sessão do editor. É rastreado à parte do
   * rascunho de propósito: limpar o seletor de regra zera `cascata()`, mas
   * não apaga o que já foi salvo — só o envio da remoção faz isso, e
   * `VagasStepComponent.persistirCascata()` só sabe que precisa enviá-la
   * consultando este sinal, não o rascunho.
   *
   * `VagasStepComponent` escreve aqui depois de cada gravação bem-sucedida
   * (`true` numa gravação normal, `false` numa remoção) — por isso é
   * `WritableSignal`, não só leitura.
   */
  readonly existeNoServidor = signal(false);

  constructor() {
    // As rotas do editor reusam a mesma instância de componente ao trocar de
    // processo (`ProcessoSeletivoStore.reset()` muda a geração, não destrói
    // a página) — sem isto, a confirmação e o rastro de "existe no servidor"
    // do processo anterior vazariam para o processo que acabou de hidratar.
    effect(() => {
      const snapshot = this.store.remoteSnapshot();
      this.existeNoServidor.set(snapshot?.cascata !== null && snapshot?.cascata !== undefined);
      this.confirmado.set(false);
    });

    // Empurra o rascunho para o controle sem disparar `valueChanges` — quem
    // decide o que está selecionado é `cascata()` (hidratação, troca de
    // processo, remoção após gravação), nunca o controle por si.
    effect(() => {
      const valor = this.valorDoSelect();
      untracked(() => {
        if (this.regraControl.value !== valor) {
          this.regraControl.setValue(valor, { emitEvent: false });
        }
      });
    });

    // Reactive Forms desabilita pelo próprio controle, não por `[disabled]`
    // no template — os dois juntos disparam aviso do Angular e o binding de
    // atributo perde a corrida contra o `FormControl`.
    effect(() => {
      const habilitado = this.store.aceitaEdicao();
      untracked(() => {
        if (habilitado && this.regraControl.disabled) this.regraControl.enable({ emitEvent: false });
        if (!habilitado && this.regraControl.enabled) this.regraControl.disable({ emitEvent: false });
      });
    });

    // O único caminho de volta: interação do operador com o seletor.
    this.regraControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((valor) => this.escolherRegra(valor));
  }

  /** A cascata está pronta para gravar: regra escolhida, matriz reconhecida, sem pendência e conferida. */
  readonly pronta = computed(
    () =>
      this.cascata() !== null &&
      this.matriz() !== null &&
      this.problemas().length === 0 &&
      this.confirmado(),
  );

  escolherRegra(valor: string): void {
    const [codigo, versao] = valor.split('|');
    this.store.patchObjectSection('vagas', {
      cascata: codigo === '' || versao === undefined || versao === '' ? null : { regraCodigo: codigo, regraVersao: versao },
    });
    this.confirmado.set(false);
  }

  rotuloDaOferta(ofertaCursoId: string): string {
    return this.catalogos.rotuloDaOferta().get(ofertaCursoId) ?? ofertaCursoId;
  }

  /**
   * A mensagem completa de um problema, com o rótulo da oferta na frente só
   * quando o problema é dela — os de cobertura da matriz (`ofertaCursoId ===
   * null`) são do processo inteiro, e prefixá-los com uma oferta escolhida
   * arbitrariamente confundiria o operador sobre onde corrigir.
   */
  rotuloDoProblema(problema: ProblemaDaCascata): string {
    return problema.ofertaCursoId === null
      ? problema.mensagem
      : `${this.rotuloDaOferta(problema.ofertaCursoId)}: ${problema.mensagem}`;
  }
}
