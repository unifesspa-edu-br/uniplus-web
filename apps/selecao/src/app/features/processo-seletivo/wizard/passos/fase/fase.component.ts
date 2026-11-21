import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { type FormGroup, ReactiveFormsModule } from '@angular/forms';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { SituacaoDosCatalogosDoCronograma } from '../cronograma/catalogos/situacao-dos-catalogos-do-cronograma.service';
import { DocumentosDaFaseComponent } from './documentos/documentos-da-fase.component';
import { ExigenciasDaFaseStore } from './documentos/exigencias-da-fase.store';
import { GatilhoDasExigenciasStore } from './documentos/gatilho-das-exigencias.store';
import { RecusasDoCampoComponent } from '../../shared/recusas/recusas-do-campo.component';
import { FaseEmEdicao } from './fase-em-edicao';
import type { FaseConfigForm } from './fase-form';
import { CicloRecursalDaFaseComponent } from './secoes/ciclo-recursal-da-fase.component';
import { DecisoesDaFaseComponent } from './secoes/decisoes-da-fase.component';
import { RegraDeRecursoDaFaseComponent } from './secoes/regra-de-recurso-da-fase.component';
import { BancasDaFaseComponent } from './secoes/bancas-da-fase.component';
import { PublicacoesDaFaseComponent } from './secoes/publicacoes-da-fase.component';

/**
 * A superfície de configuração de uma fase: o que só existe dentro dela e não
 * cabe na linha do tempo — as publicações que ela faz e o papel de cada uma, a
 * conclusão do ciclo recursal, a regra de recurso, as bancas requeridas com o
 * recorte que julgam, e as exigências documentais daquela fase.
 *
 * Quem grava é o passo Cronograma, que a embute em cada fase: fase é uma coleção só e o `PUT`
 * a substitui inteira.
 */
@Component({
  selector: 'sel-step-fase',
  imports: [
    DocumentosDaFaseComponent,
    RecusasDoCampoComponent,
    BancasDaFaseComponent,
    CicloRecursalDaFaseComponent,
    DecisoesDaFaseComponent,
    PublicacoesDaFaseComponent,
    ReactiveFormsModule,
    RegraDeRecursoDaFaseComponent,
  ],
  templateUrl: './fase.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [FaseEmEdicao, ExigenciasDaFaseStore, GatilhoDasExigenciasStore],
})
export class FasePassoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly situacao = inject(SituacaoDosCatalogosDoCronograma);
  private readonly destruicao = inject(DestroyRef);

  /** A fase a que a configuração pertence: o Cronograma embute um bloco destes em cada fase. */
  readonly faseFixada = input.required<string>();

  private readonly faseEmEdicao = inject(FaseEmEdicao);
  protected readonly exigencias = inject(ExigenciasDaFaseStore);
  protected readonly gatilho = inject(GatilhoDasExigenciasStore);

  readonly faseAberta = this.faseEmEdicao.faseAberta;
  readonly formulario = this.faseEmEdicao.espelho.formulario;
  readonly fasesDoCronograma = this.faseEmEdicao.fasesDoCronograma;
  readonly fasesNoSeletor = this.faseEmEdicao.fasesNoSeletor;
  readonly faseDoRascunho = this.faseEmEdicao.faseDoRascunho;
  readonly problemas = this.faseEmEdicao.problemas;
  readonly erroDoCampo = this.faseEmEdicao.erroDoCampo;
  readonly recusasDaConfiguracao = this.faseEmEdicao.recusasDaConfiguracao;
  readonly nomeDaBanca = this.faseEmEdicao.nomeDaBanca;
  readonly idDaFase = this.faseEmEdicao.idDaFase;

  constructor() {
    this.situacao.carregar();
    this.destruicao.onDestroy(() => this.faseEmEdicao.espelho.encerrar());
    this.manterAFaseAbertaNaFaseFixada();
    this.espelharORascunhoNoFormulario();
    this.travarForaDeRascunho();
    this.preselecionarAAncoraUnica();
  }

  private manterAFaseAbertaNaFaseFixada(): void {
    effect(() => {
      const fixada = this.faseFixada();
      untracked(() => this.faseAberta.set(fixada));
    });
  }

  private espelharORascunhoNoFormulario(): void {
    // Rascunho → formulário. É a única entrada que não veio da digitação: a
    // hidratação da leitura e a troca de fase chegam por aqui.
    effect(() => {
      const fase = this.faseDoRascunho();
      untracked(() => this.faseEmEdicao.espelho.espelhar(fase));
    });
  }

  private travarForaDeRascunho(): void {
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
  }

  /**
   * Com um só resultado preliminar não há escolha a fazer, e pré-selecionar poupa um clique. Com
   * dois — gabarito e resultado, por exemplo — a escolha é do operador: eleger um deles contaria a
   * janela da publicação errada. Ligar o interruptor não muda a lista de âncoras nem recria o
   * formulário, por isso o efeito acompanha a edição: sem isso o campo ficaria vazio esperando uma
   * escolha que não existe.
   */
  private preselecionarAAncoraUnica(): void {
    effect(() => {
      const unica = this.faseEmEdicao.ancoraUnica();
      const formulario = this.formulario();
      this.faseEmEdicao.espelho.versao();
      untracked(() => {
        if (formulario !== null && unica !== null) preencherAAncoraVazia(formulario, unica);
      });
    });
  }
}

/** Só preenche o campo vazio, e por isso nunca sobrescreve o que o operador decidiu. */
function preencherAAncoraVazia(formulario: FormGroup<FaseConfigForm>, ancoraUnica: string): void {
  if (!formulario.controls.admiteRecurso.value) return;
  const ancora = formulario.controls.recurso.controls.atoAncoraCodigo;
  if (ancora.value === '') ancora.setValue(ancoraUnica);
}
