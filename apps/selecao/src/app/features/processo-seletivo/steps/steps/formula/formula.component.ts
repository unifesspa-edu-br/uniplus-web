import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AuthService } from '@uniplus/shared-auth/bootstrap';
import { AppConfigService, resolveConfiguracaoWebUrl } from '@uniplus/shared-data/config';
import { formatarNumeroPtBr } from '@uniplus/shared-utils';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';
import { provePassoDoWizard } from '../../passo-do-wizard';
import {
  ReleituraDoSnapshot,
  relerProcessoAPedido,
} from '../../shared/releitura-do-snapshot.service';
import { MOTIVO_DA_RELEITURA } from '../../shared/motivo-da-releitura';
import { AcompanhamentoDoCadastroDePesos } from '../classificacao/acompanhamento-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import {
  REGRA_CALCULO_IMPORTADA,
  TEXTO_DA_PENDENCIA_DA_RESOLUCAO,
  classificacaoUsaFormulaLocal,
  divisorDaMediaValido,
  exigeResolucaoPesoAreaEnem,
  mensagensDeClassificacaoBase,
  pendenciaDaResolucao,
} from '../classificacao/classificacao-para-comando';
import { lerChaveDaRegra, regrasEscolhiveis } from '../classificacao/regra-escolhivel';
import {
  colunasDoQuadro,
  mesmoQuadro,
  ordemDasAreas,
  perdeuGrupo,
  quadroVigente,
  type AreaDoQuadro,
  type GrupoDoQuadro,
} from '../../shared/quadro-de-pesos';

/** Uma opção do seletor de resolução — o valor é o que o servidor recebe. */
interface ResolucaoEscolhivel {
  readonly valor: string;
  readonly rotulo: string;
}

const ID_DO_CAMPO_RESOLUCAO = 'f-resolucao-peso-area';
const ID_DO_TITULO_DA_SECAO = 'peso-area-titulo';

/**
 * Fórmula, precisão e ordem de alocação da classificação (UNI-REQ-0482).
 *
 * Coleta até `regrasEliminacao`, que é do passo Eliminação — que também é
 * quem grava o corpo inteiro em `PUT …/classificacao`. Este passo não tem
 * `persistir()` próprio: gravar duas vezes enviaria `regrasEliminacao` vazio
 * na primeira e derrubaria o item de conformidade que a Eliminação acabou de
 * levantar.
 *
 * A classificação é bimodal (INV-B8): sob `CLASSIFICACAO-IMPORTADA`, precisão
 * e eliminação não se aplicam, e a seção de precisão desaparece — não fica
 * desabilitada, some, porque o que o operador vê tem de bater com o que será
 * enviado (`null` nos dois campos).
 *
 * A resolução de Peso por Área segue a mesma regra: aparece só quando a classificação a exige
 * (baseada em ENEM, com a média ponderada local), junto com um quadro de pesos só leitura. Se a
 * resolução do rascunho é a que o processo já gravou, o quadro é a cópia congelada no processo —
 * o Seleção não lê o cadastro vivo para mostrar o que já congelou. Senão, é a prévia do cadastro
 * da Configuração: o que a Eliminação copia para o processo ao gravar a classificação.
 */
@Component({
  selector: 'sel-step-formula',
  standalone: true,
  templateUrl: './formula.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(FormulaStepComponent)],
})
export class FormulaStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacaoService);
  private readonly appConfig = inject(AppConfigService);
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);
  private destruida = false;
  private readonly releitura = inject(ReleituraDoSnapshot);

  readonly relendoProcesso = signal(false);

  /** Campos inválidos detectados na última validação (chave → `.is-invalid`). */
  readonly invalidFields = signal<ReadonlySet<string>>(new Set());

  readonly idDoCampoResolucao = ID_DO_CAMPO_RESOLUCAO;

  readonly avisoDaLista = signal<string | null>(null);

  /** As rotas do cadastro de Peso por Área só admitem quem administra a plataforma. */
  readonly administraPlataforma = computed(() => this.authService.hasRole('plataforma-admin'));

  /**
   * O cadastro de Peso por Área, no app da Configuração. Abre em outra aba: o rascunho do
   * processo ainda não foi gravado, e sair da página o perderia.
   */
  readonly linkDoCadastroDePesos = computed(
    () => `${resolveConfiguracaoWebUrl(this.appConfig.config())}/pesos-por-area`,
  );

  readonly exigeResolucao = computed(() =>
    exigeResolucaoPesoAreaEnem(this.store.draft().classificacao),
  );

  private readonly cadastroDePesos = inject(AcompanhamentoDoCadastroDePesos);

  constructor() {
    this.cadastroDePesos.acompanhar();
    this.catalogos.carregar();
    inject(DestroyRef).onDestroy(() => (this.destruida = true));
  }

  /**
   * Marcada como baseada em ENEM, mas com a nota importada pronta: não há pesos a aplicar, e
   * a tela diz por que o seletor não aparece em vez de sumir com ele em silêncio.
   */
  readonly enemComNotaImportada = computed(() => {
    const classificacao = this.store.draft().classificacao;
    return (
      classificacao.baseadoEmEnem && classificacao.regraCalculoCodigo === REGRA_CALCULO_IMPORTADA
    );
  });

  readonly resolucaoEscolhida = computed(
    () => this.store.draft().classificacao.resolucaoPesoAreaEnem,
  );

  /** A resolução escolhida saiu do cadastro — dito só depois de o cadastro ter sido lido. */
  readonly resolucaoForaDoCadastro = computed(() =>
    this.cadastroDePesos.resolucaoForaDoCadastro(this.resolucaoEscolhida()),
  );

  /**
   * O aviso de que a resolução saiu do cadastro promete uma recusa na próxima gravação: só faz
   * sentido quando o processo aceita edição.
   */
  readonly avisaForaDoCadastro = computed(
    () => this.store.edicaoPermitida() && this.resolucaoForaDoCadastro(),
  );

  /**
   * As resoluções do cadastro. A escolha do rascunho que não está na lista continua oferecida —
   * como `regrasEscolhiveis` faz com as regras —, e só é marcada "fora do cadastro" quando a
   * leitura do cadastro permite afirmar isso.
   */
  readonly resolucoesEscolhiveis = computed<readonly ResolucaoEscolhivel[]>(() => {
    const doCadastro = this.catalogos.resolucoesPesoAreaEnem();
    const opcoes = doCadastro.map((resolucao) => ({ valor: resolucao, rotulo: resolucao }));
    const escolhida = this.resolucaoEscolhida();
    if (escolhida === '' || doCadastro.includes(escolhida)) return opcoes;

    const rotulo = this.resolucaoForaDoCadastro() ? `${escolhida} (fora do cadastro)` : escolhida;
    return [{ valor: escolhida, rotulo }, ...opcoes];
  });

  private readonly quadroGravado = computed(() => this.store.copiaCongeladaEmVigor()?.grupos ?? []);

  private readonly quadroVigente = computed(() =>
    quadroVigente(
      this.resolucaoEscolhida(),
      this.store.copiaCongeladaEmVigor(),
      this.cadastroDePesos.quadroDaResolucaoEscolhida(),
    ),
  );

  readonly mostraQuadroGravado = computed(() => this.quadroVigente().daCopiaCongelada);

  /** O aviso de que o quadro à vista é a prévia, porque só uma releitura diz o que ficou congelado. */
  readonly avisoDeQuadroPorReler = computed(() => {
    const motivo = this.store.motivoDaReleituraDaClassificacao();
    return this.exigeResolucao() && motivo !== null
      ? `${MOTIVO_DA_RELEITURA[motivo]}. Enquanto isso, o quadro abaixo é a prévia do cadastro.`
      : null;
  });

  readonly quadro = computed<readonly GrupoDoQuadro[]>(() => this.quadroVigente().grupos);

  readonly colunasDoQuadro = computed(() =>
    colunasDoQuadro(this.quadro(), ordemDasAreas(this.catalogos.areasEnem())),
  );

  /**
   * O cadastro mudou depois de o processo congelar a resolução. Cada gravação da classificação —
   * inclusive a que a publicação faz — copia de novo do cadastro, então o operador precisa saber
   * que o quadro à vista não é o que a próxima gravação vai deixar no processo.
   */
  readonly cadastroMudouDesdeAGravacao = computed(
    () =>
      this.store.edicaoPermitida() &&
      this.mostraQuadroGravado() &&
      // Só um cadastro lido depois da cópia pode dizer que ela ficou para trás: a leitura da
      // classificação que traz outra cópia deixa a do cadastro sem valer até ele ser relido (ver
      // `AcompanhamentoDoCadastroDePesos`).
      this.cadastroDePesos.leitura().lido &&
      !this.resolucaoForaDoCadastro() &&
      !mesmoQuadro(this.quadroGravado(), this.cadastroDePesos.quadroDaResolucaoEscolhida()),
  );

  /**
   * A diferença é um grupo que saiu do cadastro: a próxima gravação não copia, é recusada por
   * resolução incompleta, e o aviso tem de dizer isso.
   */
  readonly cadastroPerdeuGrupo = computed(
    () =>
      this.cadastroMudouDesdeAGravacao() &&
      perdeuGrupo(this.quadroGravado(), this.cadastroDePesos.quadroDaResolucaoEscolhida()),
  );

  /**
   * O que aparece sob o seletor: a pendência local depois de "Próximo", e senão as recusas que o
   * servidor devolveu para o campo na última gravação da classificação — a da resolução e a de um
   * critério de desempate gravado, as duas quando vierem.
   */
  readonly erroDaResolucao = computed<string | null>(() => {
    const pendencia = this.invalidFields().has('resolucaoPesoAreaEnem')
      ? pendenciaDaResolucao(
          this.store.draft().classificacao,
          this.cadastroDePesos.resolucaoForaDoCadastro,
        )
      : null;
    return pendencia !== null
      ? TEXTO_DA_PENDENCIA_DA_RESOLUCAO[pendencia].campo
      : [this.store.recusaDaResolucaoPesoAreaEnem(), this.store.recusaPeloDesempatePorArea()]
          .filter((recusa) => recusa !== null)
          .join(' ') || null;
  });

  readonly descricaoDaResolucao = computed(() => {
    const ids = [`${ID_DO_CAMPO_RESOLUCAO}-dica`];
    if (this.erroDaResolucao() !== null) ids.unshift(`${ID_DO_CAMPO_RESOLUCAO}-erro`);
    return ids.join(' ');
  });

  areaDoGrupo(grupo: GrupoDoQuadro, codigoDaArea: string): AreaDoQuadro | undefined {
    return grupo.areas.find((area) => area.codigo === codigoDaArea);
  }

  readonly formatarNumero = formatarNumeroPtBr;

  readonly usaFormulaLocal = computed(() =>
    classificacaoUsaFormulaLocal(this.store.draft().classificacao.regraCalculoCodigo),
  );

  readonly regrasCalculo = computed(() => {
    const classificacao = this.store.draft().classificacao;
    return regrasEscolhiveis(
      this.catalogos.regrasCalculo(),
      classificacao.regraCalculoCodigo,
      classificacao.regraCalculoVersao,
    );
  });

  readonly regrasArredondamento = computed(() => {
    const classificacao = this.store.draft().classificacao;
    return regrasEscolhiveis(
      this.catalogos.regrasArredondamento(),
      classificacao.regraArredondamentoCodigo,
      classificacao.regraArredondamentoVersao,
    );
  });

  readonly regrasOrdemAlocacao = computed(() => {
    const classificacao = this.store.draft().classificacao;
    return regrasEscolhiveis(
      this.catalogos.regrasOrdemAlocacao(),
      classificacao.regraOrdemAlocacaoCodigo,
      classificacao.regraOrdemAlocacaoVersao,
    );
  });

  /**
   * Aviso antecipado do que a Eliminação vai recusar ao gravar: sob fórmula
   * local, sem etapa que componha a nota o divisor da média fica zero. Não
   * bloqueia este passo — só o `persistir()` da Eliminação bloqueia —, mas
   * avisa aqui porque é onde o operador acabou de escolher a fórmula.
   */
  readonly avisoDeDivisorInvalido = computed(
    () => this.usaFormulaLocal() && !divisorDaMediaValido(this.store.draft().cronograma.etapas),
  );

  escolherRegraCalculo(valor: string): void {
    const { codigo, versao } = lerChaveDaRegra(valor);
    if (codigo === '') {
      this.store.patchObjectSection('classificacao', {
        regraCalculoCodigo: '',
        regraCalculoVersao: '',
      });
      this.descartarRecusaQueNaoSeAplica();
      return;
    }

    const local = classificacaoUsaFormulaLocal(codigo);
    this.store.patchObjectSection('classificacao', {
      regraCalculoCodigo: codigo,
      regraCalculoVersao: versao,
      // A troca de ramo (local ↔ importada) não some com o que o operador já
      // digitou do outro lado — o mapeador para o comando é quem decide o que
      // enviar (INV-B8). Só a saída explícita do formulário local zera o
      // arredondamento aqui, para o `<select>` não continuar mostrando uma
      // escolha que o ramo atual não usa.
      ...(local ? {} : { regraArredondamentoCodigo: '', regraArredondamentoVersao: '' }),
    });
    this.descartarRecusaQueNaoSeAplica();
  }

  escolherRegraArredondamento(valor: string): void {
    const { codigo, versao } = lerChaveDaRegra(valor);
    this.store.patchObjectSection('classificacao', {
      regraArredondamentoCodigo: codigo,
      regraArredondamentoVersao: versao,
    });
  }

  alterarCasasArredondamento(valor: string): void {
    this.store.patchObjectSection('classificacao', { casasArredondamento: valor });
  }

  escolherRegraOrdemAlocacao(valor: string): void {
    const { codigo, versao } = lerChaveDaRegra(valor);
    this.store.patchObjectSection('classificacao', {
      regraOrdemAlocacaoCodigo: codigo,
      regraOrdemAlocacaoVersao: versao,
    });
  }

  alterarNOpcoesAlocacao(valor: string): void {
    this.store.patchObjectSection('classificacao', { nOpcoesAlocacao: valor });
  }

  aoAlternarBaseadoEmEnem(evento: Event): void {
    if (evento.target instanceof HTMLInputElement)
      this.alternarBaseadoEmEnem(evento.target.checked);
  }

  /**
   * Desmarcar o ENEM é desistir da resolução: a escolha sai do rascunho, e remarcar pede uma nova.
   * A troca de regra de cálculo, ao contrário, guarda a escolha como guarda o outro ramo (INV-B8).
   */
  alternarBaseadoEmEnem(checked: boolean): void {
    this.store.patchObjectSection('classificacao', {
      baseadoEmEnem: checked,
      ...(checked ? {} : { resolucaoPesoAreaEnem: '' }),
    });
    this.descartarRecusaQueNaoSeAplica();
  }

  /**
   * Fora da classificação que exige a resolução o comando envia `null`, e a recusa guardada julgou
   * uma escolha que deixou de ser enviada: voltar a exigi-la leva a escolha ao servidor de novo.
   */
  private descartarRecusaQueNaoSeAplica(): void {
    if (exigeResolucaoPesoAreaEnem(this.store.draft().classificacao)) return;
    this.store.descartarRecusasDaClassificacao();
  }

  aoEscolherResolucao(evento: Event): void {
    if (evento.target instanceof HTMLSelectElement) this.escolherResolucao(evento.target.value);
  }

  escolherResolucao(valor: string): void {
    if (!this.store.aceitaEdicao() || valor === this.resolucaoEscolhida()) return;
    this.store.patchObjectSection('classificacao', { resolucaoPesoAreaEnem: valor });
    // A recusa era sobre a escolha anterior; a nova ainda não foi julgada pelo servidor.
    this.store.descartarRecusasDaClassificacao();
  }

  /**
   * "Atualizar lista": o operador criou ou corrigiu uma resolução no app da Configuração, na outra
   * aba, e voltou. O anúncio diz que a lista foi atualizada, sem mover o foco.
   */
  atualizarListaDePesos(): void {
    if (this.catalogos.pesosCarregando()) return;
    this.avisoDaLista.set(null);
    this.cadastroDePesos.relerCadastroAPedido(() =>
      this.avisoDaLista.set('Lista de resoluções de Peso por Área atualizada.'),
    );
  }

  /**
   * "Tentar novamente" do cadastro de pesos. O alerta, com o botão focado, fica na tela enquanto
   * a nova tentativa corre — tirá-lo no clique jogaria o foco no `body`. Quando a lista chega e o
   * alerta sai, o foco vai ao seletor da resolução, ou ao título da seção quando o processo não
   * aceita edição.
   */
  tentarCarregarPesosDeNovo(): void {
    this.cadastroDePesos.relerCadastroAPedido(() => this.focarDepoisDeReler());
  }

  /**
   * "Reler o processo" do aviso de quadro não relido. O aviso fica, com o botão focado, enquanto a
   * leitura corre; quando ela decide e o aviso sai, o foco vai ao título da seção. Uma leitura
   * superada por outra mais nova não mexe no foco: quem decide é a mais nova.
   */
  async relerProcesso(): Promise<void> {
    const decidiu = await relerProcessoAPedido(this.releitura, this.relendoProcesso);
    if (decidiu && !this.store.classificacaoPorReler()) {
      this.focarQuemSobrou(ID_DO_TITULO_DA_SECAO);
    }
  }

  private focarDepoisDeReler(): void {
    // Sem edição o seletor fica desabilitado e não recebe foco: o título da seção é o destino.
    this.focarQuemSobrou(this.store.aceitaEdicao() ? ID_DO_CAMPO_RESOLUCAO : ID_DO_TITULO_DA_SECAO);
  }

  /**
   * Só recupera o foco que um aviso levou embora; quem já foi para outro campo não é arrastado.
   * A leitura que pede o foco pode terminar depois de o passo ser desmontado (troca de processo),
   * e aí não há o que focar.
   */
  private focarQuemSobrou(destino: string): void {
    if (this.destruida) return;
    afterNextRender(
      () => {
        const ativo = document.activeElement;
        if (ativo !== null && ativo !== document.body) return;
        document.getElementById(destino)?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * Validação declarativa — acionada pela page ao clicar em "Próximo". As
   * mensagens vêm de `mensagensDeClassificacaoBase`, a mesma fonte que a
   * Eliminação usa para os campos desta tela — a Eliminação persiste o
   * comando inteiro e não pode divergir sobre o que conta como válido aqui.
   * O `Set` de campos inválidos é só para o destaque `.is-invalid` deste
   * template, então continua calculado à parte.
   */
  validate(): StepValidation {
    const classificacao = this.store.draft().classificacao;
    const invalid = new Set<string>();

    if (!classificacao.regraCalculoCodigo) invalid.add('regraCalculo');

    if (this.usaFormulaLocal()) {
      if (!classificacao.regraArredondamentoCodigo) invalid.add('regraArredondamento');
      const casas = numero(classificacao.casasArredondamento);
      if (casas === null || casas <= 0) invalid.add('casasArredondamento');
    }

    if (!classificacao.regraOrdemAlocacaoCodigo) invalid.add('regraOrdemAlocacao');

    const nOpcoes = numero(classificacao.nOpcoesAlocacao);
    if (nOpcoes !== 1 && nOpcoes !== 2) invalid.add('nOpcoesAlocacao');

    if (
      pendenciaDaResolucao(classificacao, this.cadastroDePesos.resolucaoForaDoCadastro) !== null
    ) {
      invalid.add('resolucaoPesoAreaEnem');
    }

    this.invalidFields.set(invalid);

    const messages = mensagensDeClassificacaoBase(
      classificacao,
      this.cadastroDePesos.resolucaoForaDoCadastro,
    );
    return messages.length ? { valid: false, messages: [...messages] } : { valid: true };
  }
}

function numero(texto: string): number | null {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : null;
}
