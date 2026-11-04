import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import type { ProblemDetails } from '@uniplus/shared-core/http';

import { type FaseDoCronograma, type ValidacaoDoPasso } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { gravarCronogramaFases } from '../cronograma/servicos/gravacao-do-cronograma.service';
import { CatalogosDoCronograma } from '../cronograma/catalogos-do-cronograma.service';
import { problemasDaFase } from './configuracao-da-fase';
import { DocumentosDaFaseComponent } from './documentos/documentos-da-fase.component';
import { ExigenciasDaFaseStore } from './documentos/exigencias-da-fase.store';
import { GatilhoDasExigenciasStore } from './documentos/gatilho-das-exigencias.store';
import { FaseEmEdicao } from './fase-em-edicao';
import { CicloRecursalDaFaseComponent } from './secoes/ciclo-recursal-da-fase.component';
import { RegraDeRecursoDaFaseComponent } from './secoes/regra-de-recurso-da-fase.component';
import { BancasDaFaseComponent } from './secoes/bancas-da-fase.component';
import { recusaDaGravacao } from './recusas-da-gravacao';
import { PublicacoesDaFaseComponent } from './secoes/publicacoes-da-fase.component';

/**
 * A superfície de configuração de uma fase: o que só existe dentro dela e não
 * cabe na linha do tempo — as publicações que ela faz e o papel de cada uma, a
 * conclusão do ciclo recursal, a regra de recurso, as bancas requeridas com o
 * recorte que julgam, e as exigências documentais daquela fase.
 *
 * Grava pelo comando do cronograma, porque fase é uma coleção só e o `PUT` a
 * substitui inteira. Por isso envia todas as fases, e não a que está aberta —
 * mandar só ela apagaria as demais.
 */
@Component({
  selector: 'sel-step-fase',
  imports: [
    DocumentosDaFaseComponent,
    BancasDaFaseComponent,
    ValorLegivelDirective,
    FormsModule,
    CicloRecursalDaFaseComponent,
    PublicacoesDaFaseComponent,
    ReactiveFormsModule,
    RegraDeRecursoDaFaseComponent,
  ],
  templateUrl: './fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provePassoDoWizard(FaseStepComponent),
    FaseEmEdicao,
    ExigenciasDaFaseStore,
    GatilhoDasExigenciasStore,
  ],
})
export class FaseStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDoCronograma);
  private readonly cadastro = inject(CadastroInicial);
  private readonly destruicao = inject(DestroyRef);

  /**
   * Quando declarada, a configuração pertence a essa fase e o seletor próprio some: é o
   * modo em que o passo Cronograma embute este bloco dentro de cada fase da linha do
   * tempo, em vez de repetir a fase num combo no rodapé.
   */
  readonly faseFixada = input<string | null>(null);

  private readonly faseEmEdicao = inject(FaseEmEdicao);
  protected readonly exigencias = inject(ExigenciasDaFaseStore);
  protected readonly gatilho = inject(GatilhoDasExigenciasStore);

  readonly faseAberta = this.faseEmEdicao.faseAberta;
  readonly formulario = this.faseEmEdicao.espelho.formulario;
  readonly recusaPorCampo = this.faseEmEdicao.recusaPorCampo;
  readonly recusasGerais = this.faseEmEdicao.recusasGerais;
  readonly fasesDoCronograma = this.faseEmEdicao.fasesDoCronograma;
  readonly fasesNoSeletor = this.faseEmEdicao.fasesNoSeletor;
  readonly faseDoRascunho = this.faseEmEdicao.faseDoRascunho;
  readonly nomeDaFaseAberta = this.faseEmEdicao.nomeDaFaseAberta;
  readonly problemas = this.faseEmEdicao.problemas;
  readonly erroDoCampo = this.faseEmEdicao.erroDoCampo;
  readonly nomeDaBanca = this.faseEmEdicao.nomeDaBanca;
  readonly idDaFase = this.faseEmEdicao.idDaFase;
  private readonly atoPorCodigo = this.faseEmEdicao.atoPorCodigo;

  constructor() {
    this.catalogos.carregar();
    this.destruicao.onDestroy(() => this.faseEmEdicao.espelho.encerrar());

    // A fase aberta acompanha o cronograma: sem escolha, ou com a escolha já
    // removida da linha do tempo, abre a primeira. Deixar a tela apontando para
    // uma fase que saiu mostraria um formulário sem dono.
    effect(() => {
      const fases = this.fasesDoCronograma();
      const fixada = this.faseFixada();
      untracked(() => {
        if (fixada !== null) {
          this.faseAberta.set(fixada);
          return;
        }

        if (fases.some((fase) => fase.faseCanonicaId === this.faseAberta())) return;
        this.faseAberta.set(fases[0]?.faseCanonicaId ?? '');
      });
    });

    // Rascunho → formulário. É a única entrada que não veio da digitação: a
    // hidratação da leitura e a troca de fase chegam por aqui.
    effect(() => {
      const fase = this.faseDoRascunho();
      untracked(() => this.faseEmEdicao.espelho.espelhar(fase));
    });

    // Fora de rascunho o servidor recusa qualquer gravação, e deixar a tela
    // aceitar digitação faria a revisão exibir o que o avanço descarta.
    effect(() => {
      const editavel = this.store.aceitaEdicao();
      const formulario = this.formulario();
      untracked(() => {
        if (formulario === null) return;
        if (editavel) formulario.enable({ emitEvent: false });
        else formulario.disable({ emitEvent: false });
      });
    });

    // Com um só resultado preliminar não há escolha a fazer, e pré-selecionar
    // poupa um clique. Com dois — gabarito e resultado, por exemplo — a escolha
    // é do operador: eleger um deles contaria a janela da publicação errada.
    // Só preenche o campo vazio, e por isso nunca sobrescreve o que ele decidiu.
    effect(() => {
      const unica = this.faseEmEdicao.ancoraUnica();
      const formulario = this.formulario();
      // Ligar o interruptor não muda a lista de âncoras nem recria o
      // formulário: sem acompanhar a edição, o campo ficaria vazio esperando
      // uma escolha que não existe.
      this.faseEmEdicao.espelho.versao();
      untracked(() => {
        if (formulario === null || unica === null) return;
        if (!formulario.controls.admiteRecurso.value) return;
        const ancora = formulario.controls.recurso.controls.atoAncoraCodigo;
        if (ancora.value === '') ancora.setValue(unica);
      });
    });
  }

  abrirFase(faseCanonicaId: string): void {
    this.faseAberta.set(faseCanonicaId);
    this.faseEmEdicao.limparRecusa();
  }

  // ─── Conferência e gravação ─────────────────────────────────────────────

  /**
   * A conferência do passo cobre **todas** as fases, não só a aberta: a
   * navegação do wizard é livre, e conferir apenas o que está à vista deixaria
   * publicar um certame com outra fase mal declarada.
   */
  validate(): ValidacaoDoPasso {
    const fases = this.fasesDoCronograma();
    const nomes = new Map(this.fasesNoSeletor().map((fase) => [fase.faseCanonicaId, fase.nome]));

    const mensagens = fases.flatMap((fase) =>
      problemasDaFase(fase, fases, this.atoPorCodigo(), (id) => this.nomeDaBanca(id)).map(
        (problema) => `${nomes.get(fase.faseCanonicaId) ?? fase.codigo}: ${problema.mensagem}`,
      ),
    );

    return mensagens.length === 0 ? { valid: true } : { valid: false, messages: mensagens };
  }

  /**
   * As conferências das exigências NÃO moram aqui.
   *
   * Esta superfície é embutida no passo do Cronograma com `faseFixada`, e a página do wizard
   * coleta os passos por `viewChildren` — só o Cronograma é um passo declarado, então este
   * `validate()` nunca é chamado. Conferência escrita aqui é conferência que não roda: as três
   * que existiam (fase fora do cronograma, exigência sem modalidade, reenvio sem
   * complementação) estão em `problemasDeAncoragem`, alimentadas por `exigenciasDeclaradas`
   * do Cronograma.
   */

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  /**
   * Grava a configuração das fases pelo comando do cronograma: é uma coleção
   * só, e o `PUT` a substitui inteira. Envia na ordem do rascunho — a mesma que
   * localiza cada recusa devolvida.
   *
   * Vai pelo mesmo colaborador que a linha do tempo usa, e não direto ao
   * serviço: uma reordenação feita lá fica no rascunho até alguém gravar, e
   * quem grava pode ser esta tela. Sem o contorno da permutação, ela devolveria
   * a recusa de uma troca de posições que nem dá para desfazer daqui.
   */
  async persistir(): Promise<ValidacaoDoPasso> {
    // Embutido na linha do tempo, a gravação é do passo que contém: as duas leem as
    // mesmas fases do rascunho, e gravar de novo por fase mandaria o cronograma inteiro
    // uma vez para cada uma.
    if (this.faseFixada() !== null) return { valid: true };

    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return {
        valid: false,
        messages: ['O cadastro do processo precisa estar concluído antes de configurar as fases.'],
      };
    }

    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;

    const fases = this.store.draft().cronograma.fases;
    const geracao = this.store.geracao();
    this.store.salvando.set(true);
    try {
      const gravacao = await gravarCronogramaFases(this.cadastro, processoId, fases);
      if (geracao !== this.store.geracao()) return { valid: false, messages: [] };
      if (!gravacao.ok) return this.registrarRecusa(gravacao.problem, fases);

      this.faseEmEdicao.limparRecusa();
      return { valid: true };
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  private registrarRecusa(
    problema: ProblemDetails,
    fases: readonly FaseDoCronograma[],
  ): ValidacaoDoPasso {
    const recusa = recusaDaGravacao(
      problema,
      fases,
      this.faseAberta(),
      new Map(this.fasesNoSeletor().map((fase) => [fase.faseCanonicaId, fase.nome])),
    );
    this.recusaPorCampo.set(recusa.porCampo);
    this.recusasGerais.set(recusa.gerais);
    return recusa.validacao;
  }
}
