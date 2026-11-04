import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { provePassoDoWizard } from '../../passo-do-wizard';
import { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { leituraDoCampoDecimal } from '../../shared/numero-do-campo';
import { LeituraDoCadastroDePesos } from '../classificacao/leitura-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';
import {
  REGRA_CALCULO_IMPORTADA,
  classificacaoUsaFormulaLocal,
  divisorDaMediaValido,
  exigeResolucaoPesoAreaEnem,
  mensagensDeClassificacaoBase,
  pendenciasDaClassificacaoBase,
} from '../classificacao/classificacao-para-comando';
import { declaraEdicoesDoEnem, rotuloDaEdicao } from '../classificacao/edicoes-do-enem';
import {
  FORMATO_DA_ESCALA_DA_NOTA_FINAL,
  escalaDaNotaFinalIlegivel,
  leituraDaEscalaDaNotaFinal,
} from '../classificacao/escala-da-nota-final';
import {
  lerChaveDaRegra,
  regrasEscolhiveis,
  rotuloDaRegraEscolhida,
} from '../classificacao/regra-escolhivel';
import { EdicoesDoEnemComponent } from './edicoes-do-enem.component';
import { PesoPorAreaComponent } from './peso-por-area.component';

const ID_DO_CAMPO_ESCALA = 'f-escala-nota-final';

/**
 * Fórmula, precisão e ordem de alocação da classificação (UNI-REQ-0482).
 *
 * Coleta até `regrasEliminacao`, que é do passo Eliminação, quem grava o corpo inteiro em
 * `PUT …/classificacao`. Este passo não tem `persistir()`: gravar duas vezes enviaria
 * `regrasEliminacao` vazio na primeira e derrubaria o item de conformidade que a Eliminação
 * acabou de levantar.
 *
 * A classificação é bimodal: sob `CLASSIFICACAO-IMPORTADA`, precisão e eliminação não se
 * aplicam e a seção some em vez de ficar desabilitada, porque o que o operador vê tem de bater
 * com o que será enviado (`null` nos dois campos).
 *
 * A resolução de Peso por Área segue a mesma regra: a seção aparece só quando a classificação a
 * exige.
 */
@Component({
  selector: 'sel-step-formula',
  standalone: true,
  imports: [
    ValorLegivelDirective,
    ValorEmConsultaComponent,
    EdicoesDoEnemComponent,
    PesoPorAreaComponent,
  ],
  templateUrl: './formula.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(FormulaPassoComponent)],
})
export class FormulaPassoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacao);
  readonly invalidFields = signal<ReadonlySet<string>>(new Set());

  readonly idDoCampoEscala = ID_DO_CAMPO_ESCALA;
  readonly formatoDaEscala = FORMATO_DA_ESCALA_DA_NOTA_FINAL;

  /** O candidato escolhe a edição na inscrição, entre as que o processo aceita. */
  readonly declaraEdicoes = computed(() => declaraEdicoesDoEnem(this.store.draft()));
  readonly edicoes = computed(() => this.store.draft().classificacao.edicoesEnem);
  readonly rotuloDaEdicao = rotuloDaEdicao;

  readonly exigeResolucao = computed(() =>
    exigeResolucaoPesoAreaEnem(this.store.draft().classificacao),
  );

  private readonly cadastroDePesos = inject(LeituraDoCadastroDePesos);

  constructor() {
    this.cadastroDePesos.iniciarLeitura();
    this.catalogos.carregar();
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

  /**
   * O que aparece sob a escala: o texto que não é número, depois de "Próximo"; senão a recusa da
   * gravação (escala que não é maior que zero) ou a pendência de publicação, que só vale enquanto
   * o campo está vazio.
   */
  readonly erroDaEscala = computed<string | null>(() => {
    const texto = this.store.draft().classificacao.escalaNotaFinal;
    if (this.invalidFields().has('escalaNotaFinal') && escalaDaNotaFinalIlegivel(texto)) {
      return FORMATO_DA_ESCALA_DA_NOTA_FINAL;
    }
    if (this.store.classificacao.recusaDaEscalaDaNotaFinal() !== null) {
      return this.store.classificacao.recusaDaEscalaDaNotaFinal();
    }
    return this.store.classificacao.escalaDaNotaFinalPendente() && texto.trim() === ''
      ? 'Declare a escala da nota final para publicar o processo.'
      : null;
  });

  readonly descricaoDaEscala = computed(() => {
    const ids = [`${ID_DO_CAMPO_ESCALA}-dica`];
    if (this.erroDaEscala() !== null) ids.unshift(`${ID_DO_CAMPO_ESCALA}-erro`);
    return ids.join(' ');
  });

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

  readonly leitura = computed(() => {
    const classificacao = this.store.draft().classificacao;
    return {
      regraCalculo: rotuloDaRegraEscolhida(this.regrasCalculo()),
      regraArredondamento: rotuloDaRegraEscolhida(this.regrasArredondamento()),
      casasDecimais: leituraDoCampoDecimal(classificacao.casasArredondamento),
      ordemAlocacao: rotuloDaRegraEscolhida(this.regrasOrdemAlocacao()),
      escalaNotaFinal: leituraDaEscalaDaNotaFinal(classificacao.escalaNotaFinal),
    };
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
      // enviar. Só a saída explícita do formulário local zera o
      // arredondamento aqui, para o `<select>` não continuar mostrando uma
      // escolha que o ramo atual não usa.
      ...(local ? {} : { regraArredondamentoCodigo: '', regraArredondamentoVersao: '' }),
    });
    if (!local) this.store.classificacao.recusaDaEscalaDaNotaFinal.set(null);
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

  alterarEscalaNotaFinal(valor: string): void {
    this.store.patchObjectSection('classificacao', { escalaNotaFinal: valor });
    // A recusa julgou o valor de antes; o novo ainda não foi ao servidor.
    this.store.classificacao.recusaDaEscalaDaNotaFinal.set(null);
  }

  escolherRegraOrdemAlocacao(valor: string): void {
    const { codigo, versao } = lerChaveDaRegra(valor);
    this.store.patchObjectSection('classificacao', {
      regraOrdemAlocacaoCodigo: codigo,
      regraOrdemAlocacaoVersao: versao,
    });
  }

  aoAlternarBaseadoEmEnem(evento: Event): void {
    if (evento.target instanceof HTMLInputElement)
      this.alternarBaseadoEmEnem(evento.target.checked);
  }

  /**
   * Desmarcar o ENEM é desistir da resolução: a escolha sai do rascunho, e remarcar pede uma nova.
   * A troca de regra de cálculo, ao contrário, guarda a escolha como guarda o outro ramo.
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
    this.store.classificacao.descartarRecusas();
  }

  /**
   * Validação declarativa — acionada pela page ao clicar em "Próximo". Os campos destacados e as
   * mensagens vêm de `pendenciasDaClassificacaoBase`, a mesma fonte que a Eliminação usa — ela
   * persiste o comando inteiro e não pode divergir sobre o que conta como válido aqui.
   */
  validar(): ValidacaoDoPasso {
    const classificacao = this.store.draft().classificacao;
    const invalid = new Set<string>(
      pendenciasDaClassificacaoBase(
        classificacao,
        this.cadastroDePesos.resolucaoForaDoCadastro,
      ).map((pendencia) => pendencia.campo),
    );

    const semEdicao = this.declaraEdicoes() && classificacao.edicoesEnem.length === 0;
    if (semEdicao) invalid.add('edicoesEnem');

    this.invalidFields.set(invalid);

    const messages = [
      ...mensagensDeClassificacaoBase(classificacao, this.cadastroDePesos.resolucaoForaDoCadastro),
      ...(semEdicao ? ['Escolha ao menos uma edição do ENEM aceita.'] : []),
    ];
    return messages.length ? { valid: false, messages } : { valid: true };
  }
}
