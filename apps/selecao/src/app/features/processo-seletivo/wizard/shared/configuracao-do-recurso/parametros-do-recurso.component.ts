import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { GuardaDaVagaCodigo } from '@uniplus/shared-data/selecao';
import { EscolhaComExplicacaoComponent } from '@uniplus/shared-ui/components';

import { CatalogoDasOpcoesDoRecurso } from '../../passos/cronograma/catalogos/catalogo-das-opcoes-do-recurso.service';
import { focarAposRenderizar } from '../foco-apos-renderizar';
import { emOrdem, haRecusaAtiva, type RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { notaDaConferencia, RecusasDoCampoComponent } from '../recusas/recusas-do-campo.component';
import { idsDosParametros } from './ids-dos-parametros';
import {
  MENSAGEM_DA_GUARDA_FIXA,
  MENSAGEM_DA_GUARDA_RETIRADA,
  MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO,
  MENSAGEM_DO_PRAZO_RETIRADO,
  MENSAGEM_DO_RECURSO_QUE_SE_ENCERRA,
  opcoesDaGuarda,
  opcoesParaEscolha,
  parametrosAlterados,
  prazoDaSegundaInstanciaRetirado,
  prazoDaSegundaInstanciaVisivel,
  type AlteracaoDosParametros,
  type CampoDosParametros,
  type LeituraDoRecurso,
  type ParametrosDoRecurso,
  type RetiradoPelaMudanca,
} from './parametros-do-recurso';
import { PrazoDoRecursoComponent } from './prazo-do-recurso.component';

type CampoDeTexto = Exclude<CampoDosParametros, 'admiteInstanciaSuperior'>;

const AVISO_DA_RETIRADA: Readonly<Record<NonNullable<RetiradoPelaMudanca>, string>> = {
  guarda: MENSAGEM_DA_GUARDA_RETIRADA,
  prazoDaSegundaInstancia: MENSAGEM_DO_PRAZO_RETIRADO,
};

const AVISO_CARREGANDO = 'Carregando as opções do recurso…';
const AVISO_FALHOU =
  'As opções do recurso não carregaram. Use "Tentar de novo" no aviso do topo do passo.';
const AVISO_SEM_OPCAO = 'Nenhuma opção disponível.';

/**
 * Os parâmetros do recurso que a regra de recurso da fase e cada recurso da etapa têm em comum, na
 * ordem em que a pessoa os responde: prazo de interposição, instância superior, efeito suspensivo
 * na 1ª instância, guarda da vaga e prazo da 2ª instância.
 *
 * O componente é controlado e não confere nada: mostra `parametros` e avisa cada mudança; quem
 * recusa é a API, e a recusa aparece junto do campo. As opções vêm da API, e o valor já gravado que
 * ela não oferece mais continua à vista e marcado. Uma região de aviso, que existe desde o primeiro
 * desenho, anuncia o que a mudança retirou e o estado da leitura das opções.
 */
@Component({
  selector: 'sel-parametros-do-recurso',
  imports: [EscolhaComExplicacaoComponent, PrazoDoRecursoComponent, RecusasDoCampoComponent],
  templateUrl: './parametros-do-recurso.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class ParametrosDoRecursoComponent {
  private readonly catalogo = inject(CatalogoDasOpcoesDoRecurso);
  private readonly injetor = inject(Injector);

  readonly parametros = input.required<ParametrosDoRecurso>();
  readonly leitura = input.required<LeituraDoRecurso>();
  /** As recusas da configuração, ativas e a conferir, cada uma no campo dos parâmetros a que se refere. */
  readonly recusas = input<readonly RecusaOrdenada[]>([]);
  /** Base dos `id`: a fase dá um por regra de recurso, e a etapa um por recurso. */
  readonly prefixoDoId = input.required<string>();
  readonly desabilitado = input(false);
  /**
   * A cópia do tipo de alguma banca do lugar diz que o recurso dela se encerra na 1ª instância. A
   * tela só avisa: quem recusa a instância superior nesse caso é a API, na publicação.
   */
  readonly encerraNaPrimeiraInstancia = input(false);

  readonly alterado = output<AlteracaoDosParametros>();
  readonly retirarPrazoDaSegundaInstancia = output<void>();

  private readonly avisoDaMudanca = signal<string | null>(null);

  protected readonly ids = computed(() => idsDosParametros(this.prefixoDoId()));
  protected readonly unidades = this.catalogo.unidadesDePrazo;
  protected readonly situacaoDasUnidades = this.catalogo.situacaoDasUnidades;
  protected readonly situacaoDosEfeitos = this.catalogo.situacaoDosEfeitos;
  protected readonly situacaoDasGuardas = this.catalogo.situacaoDasGuardas;
  protected readonly mensagemDaInstanciaSuperior = MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO;
  protected readonly mensagemDoRecursoQueSeEncerra = MENSAGEM_DO_RECURSO_QUE_SE_ENCERRA;

  protected readonly rotulos = computed(() => this.leitura().rotulos);
  protected readonly prazoDaSegundaVisivel = computed(() =>
    prazoDaSegundaInstanciaVisivel(this.parametros(), this.leitura()),
  );
  protected readonly instanciaSuperiorEmAberto = computed(
    () => this.parametros().admiteInstanciaSuperior === null,
  );
  protected readonly instanciaSuperiorInvalida = computed(() =>
    this.instanciaSuperiorEmAberto() || haRecusaAtiva(this.recusasDe('admiteInstanciaSuperior'))
      ? 'true'
      : null,
  );
  protected readonly opcoesDoEfeito = computed(() =>
    opcoesParaEscolha(
      this.catalogo.efeitosSuspensivos(),
      this.parametros().efeitoSuspensivo,
      this.rotulos().efeitoSuspensivo,
    ),
  );
  protected readonly opcoesDaGuarda = computed(() =>
    opcoesDaGuarda(
      this.catalogo.guardasDaVaga(),
      this.parametros().admiteInstanciaSuperior,
      this.parametros().guardaDaVaga,
      this.rotulos().guardaDaVaga,
    ),
  );
  protected readonly aviso = computed(
    () => this.avisoDaMudanca() ?? this.avisoDaLeituraDasOpcoes(),
  );

  /** As recusas de um campo na ordem em que se leem; o mesmo campo e código aparecem uma vez. */
  protected recusasDe(campo: CampoDosParametros): readonly RecusaOrdenada[] {
    return emOrdem(this.recusas().filter((recusa) => recusa.campo === campo));
  }

  protected ativasDe(campo: CampoDosParametros): readonly RecusaOrdenada[] {
    return this.recusasDe(campo).filter((recusa) => !recusa.aConferir);
  }

  protected aConferirDe(campo: CampoDosParametros): readonly RecusaOrdenada[] {
    return this.recusasDe(campo).filter((recusa) => recusa.aConferir);
  }

  protected notaDeConferirDe(campo: CampoDosParametros): string | null {
    const origem = this.aConferirDe(campo)[0]?.origem;
    return origem === undefined ? null : notaDaConferencia(origem);
  }

  protected alterarTexto(campo: CampoDeTexto, valor: string): void {
    this.alterar({ campo, valor });
  }

  protected escolherInstanciaSuperior(valor: boolean): void {
    this.alterar({ campo: 'admiteInstanciaSuperior', valor });
  }

  protected retirarPrazo(): void {
    const { retirado } = prazoDaSegundaInstanciaRetirado(this.parametros(), this.leitura());
    this.avisoDaMudanca.set(retirado === null ? null : AVISO_DA_RETIRADA[retirado]);
    this.retirarPrazoDaSegundaInstancia.emit();
    focarAposRenderizar(this.injetor, this.ids().instanciaSuperior.nao);
  }

  protected instrucaoDaGuarda(): string {
    const { admiteInstanciaSuperior, guardaDaVaga } = this.parametros();
    const base = 'Sem escolha, a vaga fica guardada até o resultado definitivo.';
    const fixa = admiteInstanciaSuperior === true && guardaDaVaga === GuardaDaVagaCodigo.NAO_GUARDA;
    return fixa ? `${base} ${MENSAGEM_DA_GUARDA_FIXA}` : base;
  }

  private alterar(alteracao: AlteracaoDosParametros): void {
    const { retirado } = parametrosAlterados(this.parametros(), this.leitura(), alteracao);
    this.avisoDaMudanca.set(retirado === null ? null : AVISO_DA_RETIRADA[retirado]);
    this.alterado.emit(alteracao);
  }

  private avisoDaLeituraDasOpcoes(): string {
    const { carregando, erro } = this.catalogo;
    if (carregando()) return AVISO_CARREGANDO;
    if (erro() !== null) return AVISO_FALHOU;
    return this.haListaVazia() ? AVISO_SEM_OPCAO : '';
  }

  private haListaVazia(): boolean {
    return [
      this.unidades(),
      this.catalogo.efeitosSuspensivos(),
      this.catalogo.guardasDaVaga(),
    ].some((lista) => lista.length === 0);
  }
}
