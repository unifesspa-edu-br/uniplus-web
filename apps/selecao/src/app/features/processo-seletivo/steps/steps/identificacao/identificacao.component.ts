import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { OrigemCandidatos } from '@uniplus/shared-data/selecao';
import { ValorEmConsultaComponent, ValorLegivelDirective } from '@uniplus/shared-ui/components';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { OrigemCandidatosSelecionada, ValidacaoDoPasso } from '../../processo-seletivo.models';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { IdentificadorLegivelComponent } from './identificador-legivel.component';
import { MunicipioDoProcessoComponent } from './municipio-do-processo.component';
import { BuscaDeMunicipio } from './servicos/busca-de-municipio.service';
import { CatalogoDeUnidades } from './servicos/catalogo-de-unidades.service';
import { GravacaoDaIdentificacao } from './servicos/gravacao-da-identificacao.service';
import { validarIdentificacao } from './validacao-da-identificacao';
import { provePassoDoWizard } from '../../passo-do-wizard';

/**
 * Rótulos curtos de propósito: em 320 px, a largura intrínseca da opção mais
 * longa é o que decide o piso do campo. O sentido completo fica no texto de
 * apoio do campo, que quebra em várias linhas sem esticar nada.
 */
export const ORIGENS_CANDIDATOS: readonly {
  readonly value: OrigemCandidatosSelecionada;
  readonly label: string;
}[] = [
  { value: OrigemCandidatos.inscricaoPropria, label: 'Inscrição neste sistema' },
  { value: OrigemCandidatos.importacaoExterna, label: 'Importação externa' },
];

@Component({
  selector: 'sel-step-identificacao',
  standalone: true,
  imports: [
    ValorLegivelDirective,
    ReactiveFormsModule,
    ValorEmConsultaComponent,
    MunicipioDoProcessoComponent,
    IdentificadorLegivelComponent,
  ],
  templateUrl: './identificacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    CatalogoDeUnidades,
    BuscaDeMunicipio,
    GravacaoDaIdentificacao,
    provePassoDoWizard(IdentificacaoStepComponent),
  ],
})
export class IdentificacaoStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  protected readonly unidades = inject(CatalogoDeUnidades);
  protected readonly gravacao = inject(GravacaoDaIdentificacao);
  private readonly destroyRef = inject(DestroyRef);

  readonly origens = ORIGENS_CANDIDATOS;
  /**
   * O cadastro como se lê: o que o rascunho guarda, com o rótulo de cada escolha. Serve à
   * consulta e ao resumo que confirma a criação. Sem o catálogo de unidades, a unidade vem
   * do snapshot do processo (`unidades`).
   */
  readonly leitura = computed(() => {
    const identificacao = this.store.draft().identificacao;
    const localidade = identificacao.localidade;
    return {
      nome: identificacao.nome,
      identificadorLegivel: identificacao.identificadorLegivel,
      unidade:
        this.unidades.opcoes().find((opcao) => opcao.id === identificacao.unidadeAdministradoraId)
          ?.rotulo ?? null,
      municipio: localidade === null ? null : `${localidade.nome} — ${localidade.uf}`,
      origem:
        this.origens.find((opcao) => opcao.value === identificacao.origemCandidatos)?.label ?? null,
    };
  });
  /**
   * Enquanto o cadastro inicial não existe, o operador pode corrigir tudo;
   * depois de criado, o contrato não expõe atualização de identificação, então
   * os campos que compuseram o comando ficam somente-leitura.
   */
  readonly camposDoComandoBloqueados = computed(() => this.store.cadastroInicialCongelado());
  /**
   * Uma criação sem resposta definitiva precisa ser repetida com o mesmo corpo,
   * senão a mesma chave devolve `body_mismatch` e a correção seguinte cria um
   * segundo processo. Editar não adiantaria — daí manter os campos travados,
   * aqui e no passo 1.
   */
  readonly criacaoIndefinida = this.store.criacaoIndefinida;

  /**
   * Formulário tipado dos campos que compõem o comando de criação. A
   * localidade fica fora: é um trio escolhido inteiro numa busca, não um
   * controle de texto.
   *
   * O store continua sendo a fonte — o formulário é a superfície de edição, e
   * `valueChanges` alimenta o rascunho.
   */
  readonly form = new FormGroup({
    nome: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    unidadeAdministradoraId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    origemCandidatos: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  /**
   * O identificador legível fica fora do formulário do comando: ao contrário dos demais, ele
   * continua editável depois da criação, enquanto o processo for rascunho — é declarado pelo
   * PUT do próprio campo, e só a publicação o fixa.
   */
  readonly identificadorLegivel = new FormControl('', { nonNullable: true });

  constructor() {
    this.ligarIdentificadorLegivel();
    this.ligarFormulario();
  }

  /**
   * O botão diz o que faz. Concluir este passo cria o Processo Seletivo no
   * servidor, ao contrário dos demais, onde avançar só muda de tela.
   *
   * São três estados, e não dois. Com o processo criado, avançar é só navegar.
   * Com a criação em estado indefinido — sem resposta, 5xx, conflito de
   * processamento — não há id conhecido, mas acionar o botão reenvia o mesmo
   * comando retido: chamar isso de "Próximo" descreveria navegação onde há
   * reenvio, e contradiria o aviso na tela, que pede para tentar de novo.
   */
  rotuloDeAvanco(): string {
    if (this.store.processoSeletivoId() !== null) {
      return this.gravacao.identificadorAGravar() === null ? 'Próximo' : 'Gravar e avançar';
    }
    if (this.store.criacaoIndefinida()) return 'Repetir a gravação';
    return 'Gravar e avançar';
  }

  /**
   * Resumo do que a criação vai gravar, para conferência antes de qualquer
   * requisição. Nenhum destes campos é alterável depois — o contrato não expõe
   * atualização deles — e o aviso que hoje só aparece com o cadastro já criado
   * chega aqui a tempo de o operador desistir.
   *
   * Devolve `null` com o processo já criado: não há o que gravar, e o passo
   * volta a ser navegação como os outros.
   */
  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (this.store.cadastroInicialCongelado()) return null;

    // A navegação pelo stepper é livre, então dá para chegar aqui com o tipo
    // do processo — que é do passo 1 — ainda por escolher. O resumo listaria
    // "Tipo do processo" em branco e prometeria um comando pronto que a
    // criação recusaria logo depois. Sem confirmação, a recusa de
    // `persistir()` aparece direto e nomeia o que falta.
    if (this.gravacao.camposFaltantesDoComando().length > 0) return null;

    const leitura = this.leitura();

    return {
      titulo: 'Confirmar o cadastro do processo seletivo',
      aviso:
        'Estes dados não poderão ser alterados depois de gravados. Confira antes de continuar.',
      rotuloDeConfirmar: 'Gravar processo',
      itens: [
        { rotulo: 'Nome do processo seletivo', valor: leitura.nome },
        { rotulo: 'Tipo do processo', valor: this.store.draft().tipoProcesso.rotulo },
        { rotulo: 'Unidade administradora', valor: leitura.unidade ?? '' },
        { rotulo: 'Município que rege os prazos', valor: leitura.municipio ?? '' },
        { rotulo: 'Origem dos candidatos', valor: leitura.origem ?? '' },
      ],
    };
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): ValidacaoDoPasso {
    const resultado = validarIdentificacao(
      this.store.draft().identificacao,
      this.gravacao.identificadorDeclaravel(),
    );
    if (resultado.erroDoIdentificador !== undefined) {
      this.gravacao.erroDoIdentificador.set(resultado.erroDoIdentificador);
    }
    this.gravacao.camposInvalidos.set(resultado.camposInvalidos);
    return resultado.messages.length
      ? { valid: false, messages: [...resultado.messages] }
      : { valid: true };
  }

  persistir(): Promise<ValidacaoDoPasso> {
    return this.gravacao.persistir();
  }

  private ligarIdentificadorLegivel(): void {
    this.identificadorLegivel.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valor) => {
        this.store.patchObjectSection('identificacao', { identificadorLegivel: valor });
        this.gravacao.erroDoIdentificador.set(null);
      });

    effect(() => {
      const valor = this.store.draft().identificacao.identificadorLegivel;
      if (this.identificadorLegivel.value !== valor) {
        this.identificadorLegivel.setValue(valor, { emitEvent: false });
      }
      this.habilitar(this.identificadorLegivel, this.gravacao.identificadorEditavel());
    });
  }

  private ligarFormulario(): void {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((valor) => {
      this.store.patchObjectSection('identificacao', {
        nome: valor.nome ?? '',
        unidadeAdministradoraId: valor.unidadeAdministradoraId ?? '',
        origemCandidatos: (valor.origemCandidatos ?? '') as OrigemCandidatosSelecionada,
      });
    });

    // A hidratação escreve no store; o formulário reflete sem devolver o eco, que reabriria o
    // ciclo e marcaria o campo como sujo sem o operador tocar.
    effect(() => {
      const identificacao = this.store.draft().identificacao;
      this.form.setValue(
        {
          nome: identificacao.nome,
          unidadeAdministradoraId: identificacao.unidadeAdministradoraId,
          origemCandidatos: identificacao.origemCandidatos,
        },
        { emitEvent: false },
      );
      this.habilitar(this.form, !this.store.cadastroInicialCongelado());
    });
  }

  private habilitar(controle: AbstractControl, habilitado: boolean): void {
    if (habilitado && controle.disabled) controle.enable({ emitEvent: false });
    if (!habilitado && controle.enabled) controle.disable({ emitEvent: false });
  }
}
