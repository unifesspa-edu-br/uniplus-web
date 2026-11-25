import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RegraCatalogoDto } from '@uniplus/shared-data/selecao';
import {
  FalhaDeLeituraComponent,
  RolagemFocavelDirective,
  ValorLegivelDirective,
  ValorEmConsultaComponent,
} from '@uniplus/shared-ui/components';

import type { MatrizDaOrdemDeRemanejamento } from '../../documento/edicoes/ordem-de-remanejamento.edicao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  matrizDaRegra,
  ofertasComCascataForaDoRegimeFederal,
  precisaExibirSecaoDaCascata,
  ProblemaDaCascata,
  problemasDaCascata,
} from './cascata-de-remanejamento';
import { CatalogosDeDistribuicao } from './catalogos-de-distribuicao.service';
import { modalidadesGravadasPorId } from './modalidades-da-distribuicao';
import { MatrizDaCascataComponent } from './matriz-da-cascata.component';
import {
  explicarRegra,
  RegraExplicada,
} from '../../shared/regra-explicada/regra-em-linguagem-clara';
import { regraPorChave } from '../../shared/regra-por-chave';
import { RegraExplicadaComponent } from '../../shared/regra-explicada/regra-explicada.component';
import { LeituraDaVersaoForaDaListagem } from './leitura-da-versao-fora-da-listagem.service';
import { SeletorDaRegraDaCascata } from './seletor-da-regra-da-cascata.service';

/**
 * A seção da cascata de remanejamento, dentro do passo Vagas (UNI-REQ-0134 e
 * UNI-REQ-0056).
 *
 * Não é passo próprio do wizard: a cascata é função das ofertas que o
 * operador acabou de montar na mesma tela, e só existe uma decisão por
 * processo. `VagasPassoComponent` lê este componente por `viewChild` para
 * validar e gravar — a cascata é gravada no `persistir()` do passo Vagas,
 * depois da distribuição, porque referencia modalidades que só existem
 * depois de a oferta ser gravada.
 *
 * **A tela confirma, não compõe.** O operador escolhe regra e versão; o
 * `fallbackCodigo` e os `destinos[]` são derivados do `declaracaoDaRegra`
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
    RegraExplicadaComponent,
    FalhaDeLeituraComponent,
  ],
  templateUrl: './cascata-remanejamento.component.html',
  providers: [LeituraDaVersaoForaDaListagem, SeletorDaRegraDaCascata],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CascataRemanejamentoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeDistribuicao);
  readonly seletor = inject(SeletorDaRegraDaCascata);
  private readonly versaoDaRegra = inject(LeituraDaVersaoForaDaListagem);

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

  /** A regra de remanejamento que o processo gravou, em texto — o que a consulta lê. */
  readonly regraLida = computed(() => {
    const selecao = this.cascata();
    return selecao === null ? null : `${selecao.regraCodigo} · versão ${selecao.regraVersao}`;
  });

  readonly regraNaoEncontrada = this.versaoDaRegra.regraNaoEncontrada;
  readonly falhaAoConsultarRegra = this.versaoDaRegra.falhaAoConsultarRegra;
  readonly leituraDaRegra = this.versaoDaRegra.leitura;

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

    return regraPorChave(listagem, regra.codigo, regra.versao) === undefined
      ? [...listagem, regra]
      : listagem;
  });

  /** A matriz que a regra escolhida congela — o que a tela apresenta e envia, sem editar. */
  readonly matriz = computed<MatrizDaOrdemDeRemanejamento | null>(() => {
    const regra = this.versaoDaRegra.regraEscolhida();
    return regra === undefined ? null : matrizDaRegra(regra.declaracaoDaRegra);
  });

  /** A regra existe (na listagem ou pela busca direta) mas o `declaracaoDaRegra` não tem a forma reconhecida — defeito a reportar, não matriz vazia. */
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
   * não apaga o que já foi salvo — só o envio da remoção faz isso, e a
   * gravação do passo só sabe que precisa enviá-la consultando este sinal,
   * não o rascunho.
   *
   * A gravação do passo escreve aqui depois de cada gravação bem-sucedida
   * (`true` numa gravação normal, `false` numa remoção) — por isso é
   * `WritableSignal`, não só leitura.
   */
  readonly existeNoServidor = linkedSignal(() => this.store.remoteSnapshot()?.cascata != null);

  /** A cascata está pronta para gravar quando a regra tem matriz reconhecida e sem pendências. */
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
  readonly pendenciasForaDoRegime = computed(() =>
    this.ofertasForaDoRegime().map(
      (oferta) =>
        `Cascata — ${this.catalogos.rotuloDaOfertaOuSemNome(oferta.ofertaCursoId)}: tem modalidade que segue a cascata fora do ramo federal. Corrija a regra de distribuição ou a modalidade desta oferta.`,
    ),
  );

  readonly matrizIndisponivel = computed(
    () => this.esquemaNaoReconhecido() || this.regraNaoEncontrada() || this.falhaAoConsultarRegra(),
  );

  readonly pendenciasDaRegraDeRemanejamento = computed(() => {
    if (!this.precisaExibir()) return [];
    if (this.cascata() === null) return ['Escolha a regra de remanejamento da cascata.'];
    if (this.matrizIndisponivel()) return [`Cascata — ${this.mensagemDeMatrizIndisponivel()}`];
    return this.problemas().map((problema) => `Cascata — ${this.rotuloDoProblema(problema)}`);
  });

  readonly pendenciasParaGravar = computed(() => [
    ...this.pendenciasForaDoRegime(),
    ...this.pendenciasDaRegraDeRemanejamento(),
  ]);

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
