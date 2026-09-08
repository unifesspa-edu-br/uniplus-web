import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import {
  classificacaoUsaFormulaLocal,
  divisorDaMediaValido,
  mensagensDeClassificacaoBase,
} from '../classificacao/classificacao-para-comando';
import { regrasEscolhiveis } from '../classificacao/regra-escolhivel';

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

  /** Campos inválidos detectados na última validação (chave → `.is-invalid`). */
  readonly invalidFields = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.catalogos.carregar();
  }

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

  readonly valorDoSelectDeCalculo = computed(() => {
    const classificacao = this.store.draft().classificacao;
    return `${classificacao.regraCalculoCodigo}|${classificacao.regraCalculoVersao}`;
  });

  readonly valorDoSelectDeArredondamento = computed(() => {
    const classificacao = this.store.draft().classificacao;
    return `${classificacao.regraArredondamentoCodigo}|${classificacao.regraArredondamentoVersao}`;
  });

  readonly valorDoSelectDeOrdemAlocacao = computed(() => {
    const classificacao = this.store.draft().classificacao;
    return `${classificacao.regraOrdemAlocacaoCodigo}|${classificacao.regraOrdemAlocacaoVersao}`;
  });

  escolherRegraCalculo(valor: string): void {
    const [codigo = '', versao = ''] = valor.split('|');
    if (codigo === '') {
      this.store.patchObjectSection('classificacao', {
        regraCalculoCodigo: '',
        regraCalculoVersao: '',
      });
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
  }

  escolherRegraArredondamento(valor: string): void {
    const [codigo = '', versao = ''] = valor.split('|');
    this.store.patchObjectSection('classificacao', {
      regraArredondamentoCodigo: codigo,
      regraArredondamentoVersao: versao,
    });
  }

  alterarCasasArredondamento(valor: string): void {
    this.store.patchObjectSection('classificacao', { casasArredondamento: valor });
  }

  escolherRegraOrdemAlocacao(valor: string): void {
    const [codigo = '', versao = ''] = valor.split('|');
    this.store.patchObjectSection('classificacao', {
      regraOrdemAlocacaoCodigo: codigo,
      regraOrdemAlocacaoVersao: versao,
    });
  }

  alterarNOpcoesAlocacao(valor: string): void {
    this.store.patchObjectSection('classificacao', { nOpcoesAlocacao: valor });
  }

  alternarBaseadoEmEnem(checked: boolean): void {
    this.store.patchObjectSection('classificacao', { baseadoEmEnem: checked });
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

    this.invalidFields.set(invalid);

    const messages = mensagensDeClassificacaoBase(classificacao);
    return messages.length ? { valid: false, messages: [...messages] } : { valid: true };
  }
}

function numero(texto: string): number | null {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : null;
}
