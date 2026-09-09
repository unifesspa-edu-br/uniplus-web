import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { isApiOk } from '@uniplus/shared-core/http';
import { RegraCatalogoDto, RegrasCatalogoApi } from '@uniplus/shared-data/selecao';

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
  private readonly regrasCatalogoApi = inject(RegrasCatalogoApi);
  private readonly destroyRef = inject(DestroyRef);

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

  /**
   * A versão específica de uma seleção que a listagem carregada não tem —
   * hidratação (ou uma gravação anterior) pode referenciar uma regra que
   * saiu de lá desde então (inativada, ou nova versão publicada por cima).
   * A listagem só traz o que está ativo hoje; a seleção é imutável por
   * código+versão (CA-03 da #481: item já referenciado permanece legível
   * como snapshot), então a busca é pela versão exata via
   * `RegrasCatalogoApi.obterVersao`, nunca por uma substituta.
   *
   * `null` enquanto não há por que buscar (seleção vazia, já na listagem,
   * ou catálogo ainda carregando — a listagem tem prioridade e chega
   * primeiro na maioria dos casos).
   *
   * `nao_encontrada` é reservado ao 404 — a única resposta que confirma que
   * a regra não existe. Erro de rede, 5xx ou falha de autorização são
   * `falha`: a consulta não deu certo agora, o que não prova nada sobre a
   * regra em si, e por isso é retentável (`tentarNovamenteRegra()`) em vez
   * de terminal — tratar os dois como a mesma coisa transformaria uma
   * indisponibilidade transitória num veredito permanente de "regra
   * inexistente" sobre um processo já configurado.
   */
  private readonly buscaDaVersaoFora = signal<
    | { readonly estado: 'buscando'; readonly codigo: string; readonly versao: string }
    | {
        readonly estado: 'encontrada';
        readonly codigo: string;
        readonly versao: string;
        readonly regra: RegraCatalogoDto;
      }
    | { readonly estado: 'nao_encontrada'; readonly codigo: string; readonly versao: string }
    | { readonly estado: 'falha'; readonly codigo: string; readonly versao: string }
    | null
  >(null);

  private readonly regraEscolhida = computed<RegraCatalogoDto | undefined>(() => {
    const selecao = this.cascata();
    if (selecao === null) return undefined;

    const daListagem = this.catalogos
      .regrasCascata()
      .find((regra) => regra.codigo === selecao.regraCodigo && regra.versao === selecao.regraVersao);
    if (daListagem !== undefined) return daListagem;

    const busca = this.buscaDaVersaoFora();
    return busca?.estado === 'encontrada' &&
      busca.codigo === selecao.regraCodigo &&
      busca.versao === selecao.regraVersao
      ? busca.regra
      : undefined;
  });

  /**
   * A seleção não está na listagem carregada, e a busca direta da versão
   * já terminou sem encontrá-la — diferente de "ainda carregando" (onde
   * `regraEscolhida()` fica temporariamente `undefined` sem que isso seja
   * defeito) e de "esquemaArgs malformado" (onde a regra existe).
   */
  readonly regraNaoEncontrada = computed(() => {
    const selecao = this.cascata();
    if (selecao === null) return false;
    const busca = this.buscaDaVersaoFora();
    return (
      busca?.estado === 'nao_encontrada' &&
      busca.codigo === selecao.regraCodigo &&
      busca.versao === selecao.regraVersao
    );
  });

  /**
   * A busca da versão fora da listagem falhou por um motivo que não prova
   * que a regra não existe (rede, 5xx, autorização) — diferente de
   * `regraNaoEncontrada`, que é o 404 definitivo. `tentarNovamenteRegra()`
   * é a saída: a tela nunca declara a regra inexistente sem uma resposta
   * que confirme isso.
   */
  readonly falhaAoConsultarRegra = computed(() => {
    const selecao = this.cascata();
    if (selecao === null) return false;
    const busca = this.buscaDaVersaoFora();
    return (
      busca?.estado === 'falha' &&
      busca.codigo === selecao.regraCodigo &&
      busca.versao === selecao.regraVersao
    );
  });

  readonly regraExplicada = computed<RegraExplicada | null>(() =>
    explicarRegra(this.regraEscolhida()),
  );

  /**
   * As opções que o seletor oferece: a listagem ativa, mais a regra da
   * seleção atual quando ela foi resolvida por busca direta fora da
   * listagem — sem isto, o `<select>` confirma um código/versão que
   * nenhuma `<option>` nomeia, mesmo com a matriz conferível e gravável
   * (o controle segura um valor sem opção correspondente).
   */
  readonly opcoesDoSeletor = computed<readonly RegraCatalogoDto[]>(() => {
    const listagem = this.catalogos.regrasCascata();
    const regra = this.regraEscolhida();
    if (regra === undefined) return listagem;

    const jaNaListagem = listagem.some(
      (item) => item.codigo === regra.codigo && item.versao === regra.versao,
    );
    return jaNaListagem ? listagem : [...listagem, regra];
  });

  /** A matriz que a regra escolhida congela — o que a tela apresenta e envia, sem editar. */
  readonly matriz = computed<MatrizDaRegra | null>(() => {
    const regra = this.regraEscolhida();
    return regra === undefined ? null : matrizDaRegra(regra.esquemaArgs);
  });

  /** A regra existe (na listagem ou pela busca direta) mas o `esquemaArgs` não tem a forma reconhecida — defeito a reportar, não matriz vazia. */
  readonly esquemaNaoReconhecido = computed(
    () => this.regraEscolhida() !== undefined && this.matriz() === null,
  );

  /**
   * Os rótulos ordinais das colunas — "1ª", "2ª", … —, um por posição de
   * preferência. Sai do maior número de destinos entre as origens, e não de
   * uma constante: a matriz é o que a regra do catálogo declara, e outra
   * versão pode declarar outra largura.
   */
  readonly ordinaisDaMatriz = computed<readonly string[]>(() => {
    const matriz = this.matriz();
    if (matriz === null) return [];
    const maior = matriz.ordens.reduce((maximo, ordem) => Math.max(maximo, ordem.destinos.length), 0);
    return Array.from({ length: maior }, (_, indice) => `${indice + 1}ª`);
  });

  /**
   * O destino de uma origem numa posição de preferência, ou o travessão quando
   * aquela origem tem menos destinos que a mais larga da matriz. A checagem é
   * por comprimento, e não por coalescência: o índice de um `readonly string[]`
   * é tipado como `string`, então `?? ` seria código morto (NG8102).
   */
  destinoNaPosicao(destinos: readonly string[], posicao: number): string {
    return posicao < destinos.length ? destinos[posicao] : '—';
  }

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

    // Busca a versão específica quando a seleção não está na listagem —
    // só depois dela terminar de carregar, para a listagem ter prioridade
    // e não disparar uma busca que a própria listagem resolveria a seguir.
    effect(() => {
      const selecao = this.cascata();
      const carregando = this.catalogos.carregando();
      const regras = this.catalogos.regrasCascata();
      untracked(() => this.buscarVersaoForaDaListagemSePreciso(selecao, carregando, regras));
    });
  }

  private buscarVersaoForaDaListagemSePreciso(
    selecao: { readonly regraCodigo: string; readonly regraVersao: string } | null,
    carregando: boolean,
    regras: readonly RegraCatalogoDto[],
  ): void {
    if (selecao === null || carregando) return;

    const naListagem = regras.some(
      (regra) => regra.codigo === selecao.regraCodigo && regra.versao === selecao.regraVersao,
    );
    if (naListagem) return;

    const buscaAtual = this.buscaDaVersaoFora();
    const jaTratada =
      buscaAtual !== null &&
      buscaAtual.codigo === selecao.regraCodigo &&
      buscaAtual.versao === selecao.regraVersao;
    if (jaTratada) return;

    const { regraCodigo: codigo, regraVersao: versao } = selecao;
    this.buscaDaVersaoFora.set({ estado: 'buscando', codigo, versao });
    this.regrasCatalogoApi
      .obterVersao(codigo, versao)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        // A seleção pode ter mudado enquanto a busca corria — uma resposta
        // atrasada da versão anterior não pode sobrescrever o estado da
        // busca que já está em curso para a seleção atual.
        const atual = this.cascata();
        if (atual === null || atual.regraCodigo !== codigo || atual.regraVersao !== versao) return;

        if (isApiOk(resultado)) {
          this.buscaDaVersaoFora.set({ estado: 'encontrada', codigo, versao, regra: resultado.data });
          return;
        }

        // 404 é a única resposta que confirma que a regra não existe.
        // Qualquer outra falha (rede, 5xx, autorização) não prova nada
        // sobre a regra — só que a consulta não deu certo agora.
        this.buscaDaVersaoFora.set(
          resultado.problem.status === 404
            ? { estado: 'nao_encontrada', codigo, versao }
            : { estado: 'falha', codigo, versao },
        );
      });
  }

  /**
   * Refaz a busca da versão fora da listagem depois de uma falha retentável
   * (`falhaAoConsultarRegra()`) — limpa o estado anterior para que
   * `buscarVersaoForaDaListagemSePreciso` não o veja como "já tratado" e
   * pule a tentativa nova.
   */
  tentarNovamenteRegra(): void {
    this.buscaDaVersaoFora.set(null);
    this.buscarVersaoForaDaListagemSePreciso(
      this.cascata(),
      this.catalogos.carregando(),
      this.catalogos.regrasCascata(),
    );
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
