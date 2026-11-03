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
import {
  RolagemFocavelDirective,
  ValorLegivelDirective,
  ValorEmConsultaComponent,
} from '@uniplus/shared-ui/components';

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
import { modalidadesGravadasPorId } from './modalidades-da-distribuicao';
import { MatrizDaCascataComponent } from './matriz-da-cascata.component';
import { explicarRegra, RegraExplicada } from './regra-em-linguagem-clara';
import { VersaoDeRegraForaDaListagemService } from './versao-de-regra-fora-da-listagem.service';

/**
 * A seção da cascata de remanejamento, dentro do passo Vagas (UNI-REQ-0134 e
 * UNI-REQ-0056).
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
 * (UNI-REQ-0056).
 */
@Component({
  selector: 'sel-cascata-remanejamento',
  standalone: true,
  imports: [
    ValorLegivelDirective,
    ValorEmConsultaComponent,
    ReactiveFormsModule,
    RolagemFocavelDirective,
    MatrizDaCascataComponent,
  ],
  templateUrl: './cascata-remanejamento.component.html',
  providers: [VersaoDeRegraForaDaListagemService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CascataRemanejamentoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeDistribuicaoService);
  private readonly versaoDaRegra = inject(VersaoDeRegraForaDaListagemService);

  private readonly ofertas = computed(() => this.store.draft().vagas.ofertas);
  readonly cascata = computed(() => this.store.draft().vagas.cascata);

  /** Em consulta, as modalidades como o processo as gravou, com o catálogo só a complementar. */
  private readonly modalidadePorId = computed(() =>
    this.store.emConsulta()
      ? modalidadesGravadasPorId(this.ofertas(), this.catalogos.modalidadePorId())
      : this.catalogos.modalidadePorId(),
  );

  /**
   * A seção só aparece quando há ao menos uma oferta federal com modalidade
   * `SEGUE_CASCATA` (`PendenciaDaCascata`/`ExisteCascataForaDoRegimeFederal`
   * do agregado). Fora disso, nada aqui fecha pendência nenhuma.
   */
  readonly precisaExibir = computed(() =>
    precisaExibirSecaoDaCascata(this.ofertas(), this.modalidadePorId()),
  );

  /** A seção só aparece porque o catálogo falhou: o texto não pode afirmar que a cascata se aplica. */
  readonly secaoSemConfirmacao = computed(() => this.exibirSecao() && !this.precisaExibir());

  /**
   * Em consulta o snapshot diz se cada modalidade segue a cascata, e `precisaExibir` decide por
   * ele. Só quando alguma modalidade chega sem a regra gravada a seção depende do catálogo: se ele
   * falhou, ela não sabe dizer se a cascata se aplica, e sumir seria concluir que não. Durante o
   * carregamento a exceção não vale: a seção apareceria e sumiria quando o catálogo chegasse. Só o
   * template usa: validação e gravação seguem `precisaExibir`.
   */
  readonly exibirSecao = computed(
    () =>
      this.precisaExibir() ||
      (this.store.emConsulta() &&
        this.catalogos.situacao() === 'falhou' &&
        this.cascata() !== null &&
        this.ofertas().some((oferta) =>
          oferta.modalidades.some((modalidade) => modalidade.gravada === undefined),
        )),
  );

  /**
   * Ofertas que exigiriam cascata mas usam regra de distribuição fora do
   * ramo federal — item `cascata_modalidade_fora_do_regime_federal`. A
   * correção é no quadro de vagas acima, nunca aqui.
   */
  readonly ofertasForaDoRegime = computed(() =>
    ofertasComCascataForaDoRegimeFederal(this.ofertas(), this.modalidadePorId()),
  );

  /** `"codigo|versao"`, ou `"|"` enquanto não há escolha — mesmo molde do seletor de regra da distribuição. */
  readonly valorDoSelect = computed(() => {
    const selecao = this.cascata();
    return selecao === null ? '|' : `${selecao.regraCodigo}|${selecao.regraVersao}`;
  });

  /** A regra de remanejamento que o processo gravou, em texto — o que a consulta lê. */
  readonly regraLida = computed(() => {
    const selecao = this.cascata();
    return selecao === null ? null : `${selecao.regraCodigo} · versão ${selecao.regraVersao}`;
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

  readonly regraNaoEncontrada = this.versaoDaRegra.regraNaoEncontrada;
  readonly falhaAoConsultarRegra = this.versaoDaRegra.falhaAoConsultarRegra;

  readonly regraExplicada = computed<RegraExplicada | null>(() =>
    explicarRegra(this.versaoDaRegra.regraEscolhida()),
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
    const regra = this.versaoDaRegra.regraEscolhida();
    if (regra === undefined) return listagem;

    const jaNaListagem = listagem.some(
      (item) => item.codigo === regra.codigo && item.versao === regra.versao,
    );
    return jaNaListagem ? listagem : [...listagem, regra];
  });

  /** A matriz que a regra escolhida congela — o que a tela apresenta e envia, sem editar. */
  readonly matriz = computed<MatrizDaRegra | null>(() => {
    const regra = this.versaoDaRegra.regraEscolhida();
    return regra === undefined ? null : matrizDaRegra(regra.esquemaArgs);
  });

  /** A regra existe (na listagem ou pela busca direta) mas o `esquemaArgs` não tem a forma reconhecida — defeito a reportar, não matriz vazia. */
  readonly esquemaNaoReconhecido = computed(
    () => this.versaoDaRegra.regraEscolhida() !== undefined && this.matriz() === null,
  );

  /** Encaixe entre a matriz e cada oferta federal — por oferta, nunca sobre a união (UNI-REQ-0056). */
  readonly problemas = computed<readonly ProblemaDaCascata[]>(() => {
    const matriz = this.matriz();
    if (matriz === null) return [];
    return problemasDaCascata(this.ofertas(), this.modalidadePorId(), matriz);
  });

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
    // a página) — sem isto, o rastro de "existe no servidor" do processo
    // anterior vazaria para o processo que acabou de hidratar.
    effect(() => {
      const snapshot = this.store.remoteSnapshot();
      this.existeNoServidor.set(snapshot?.cascata !== null && snapshot?.cascata !== undefined);
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
        if (habilitado && this.regraControl.disabled)
          this.regraControl.enable({ emitEvent: false });
        if (!habilitado && this.regraControl.enabled)
          this.regraControl.disable({ emitEvent: false });
      });
    });

    // O único caminho de volta: interação do operador com o seletor.
    this.regraControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((valor) => this.escolherRegra(valor));
  }

  tentarNovamenteRegra(): void {
    this.versaoDaRegra.tentarNovamente();
  }

  /**
   * A cascata está pronta para gravar: regra escolhida, matriz reconhecida e sem pendência.
   *
   * Não depende mais de o operador ter marcado nada. Enquanto dependia, um simples
   * recarregamento a derrubava — o efeito acima zerava a marca a cada hidratação — e a varredura
   * de gravação da publicação falhava com "confirme a matriz" num passo que o operador não
   * tinha aberto.
   */
  readonly pronta = computed(
    () => this.cascata() !== null && this.matriz() !== null && this.problemas().length === 0,
  );

  /**
   * Por que `matriz()` é `null` — três causas distintas, cada uma com mensagem própria (esquema
   * malformado, regra confirmadamente ausente, consulta que falhou sem confirmar nada).
   */
  mensagemDeMatrizIndisponivel(): string {
    if (this.regraNaoEncontrada()) {
      return 'A regra escolhida não foi encontrada no catálogo. Escolha outra regra ou avise o suporte.';
    }
    if (this.falhaAoConsultarRegra()) {
      return 'Não foi possível confirmar a regra escolhida — a consulta falhou. Tente novamente antes de gravar.';
    }
    return 'A regra escolhida não declara uma matriz de remanejamento no formato esperado. Escolha outra regra ou versão.';
  }

  /**
   * O que a seção ainda pede antes de gravar — vazio quando ela não se aplica a nenhuma oferta.
   *
   * A oferta fora do regime federal bloqueia o avanço mesmo quando a seção inteira não aparece
   * (`precisaExibir()` falso): sem isto, o alerta que a seção mostra seria só decorativo, e o
   * operador avançaria com `cascata_modalidade_fora_do_regime_federal` vermelho, que bloqueia a
   * publicação sem nenhuma pista de onde a correção mora.
   */
  readonly pendenciasParaGravar = computed<readonly string[]>(() => {
    const foraDoRegime = this.ofertasForaDoRegime().map(
      (oferta) =>
        `Cascata — ${this.catalogos.rotuloDaOferta().get(oferta.ofertaCursoId) ?? this.catalogos.textoDaOfertaSemNome()}: tem modalidade que segue a cascata fora do ramo federal. Corrija a regra de distribuição ou a modalidade desta oferta.`,
    );

    if (!this.precisaExibir()) return foraDoRegime;
    if (this.cascata() === null)
      return [...foraDoRegime, 'Escolha a regra de remanejamento da cascata.'];

    // A tabela não aparece quando `matriz()` é nulo: pedir para "confirmar a cascata" mandaria o
    // operador a um controle que não existe, e tratar as causas como a mesma coisa esconderia se
    // vale tentar de novo ou trocar de regra.
    const naoResolveMatriz =
      this.esquemaNaoReconhecido() || this.regraNaoEncontrada() || this.falhaAoConsultarRegra();
    if (naoResolveMatriz) {
      return [...foraDoRegime, `Cascata — ${this.mensagemDeMatrizIndisponivel()}`];
    }

    const problemas = this.problemas().map(
      (problema) => `Cascata — ${this.rotuloDoProblema(problema)}`,
    );
    return [...foraDoRegime, ...problemas];
  });

  escolherRegra(valor: string): void {
    const [codigo, versao] = valor.split('|');
    this.store.patchObjectSection('vagas', {
      cascata:
        codigo === '' || versao === undefined || versao === ''
          ? null
          : { regraCodigo: codigo, regraVersao: versao },
    });
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
