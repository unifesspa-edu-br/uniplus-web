import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  AlertComponent,
  FalhaDeLeituraComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { bloquearEnvio } from './bloquear-envio';
import { EdicaoDosFatos } from './edicao-dos-fatos';
import { CampoDaCriacao, mensagemDoCampo } from './fato-candidato-form';
import {
  CARDINALIDADES,
  COMPONENTES_DE_EXIBICAO,
  ESCOPOS,
  FONTES_DE_VALORES,
  FORMATOS_DE_TEXTO,
  ROTULO_DO_COMPONENTE_PADRAO,
  fatosDeMembroAgregaveis,
  resumoDoAgregado,
} from './fato-candidato.regras';
import { ID_DO_FATO_DE_MEMBRO, ID_DO_PONTO_DE_RESOLUCAO_DA_CRIACAO } from './ids-do-fato';
import { lerCatalogoDeFatos, lerFasesCanonicas } from './leituras-do-fato';

/**
 * O formulário de criação do fato, com o rodapé do drawer. Existe só com o drawer aberto em
 * criação, então as fases e o catálogo de fatos de membro são lidos de novo a cada abertura: o fato
 * de membro pode ter sido criado há pouco.
 */
@Component({
  selector: 'cfg-fato-criacao',
  imports: [ReactiveFormsModule, AlertComponent, FalhaDeLeituraComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-criacao.component.html',
  styleUrl: './fato-drawer.css',
})
export class FatoCriacaoComponent {
  private readonly edicao = inject(EdicaoDosFatos);

  protected readonly form = this.edicao.form;
  protected readonly dep = this.edicao.dependencias;
  protected readonly salvando = this.edicao.criando;
  protected readonly fases = lerFasesCanonicas(
    () => true,
    () => document.getElementById(ID_DO_PONTO_DE_RESOLUCAO_DA_CRIACAO),
  );
  protected readonly catalogo = lerCatalogoDeFatos(() => this.dep.agregado(), {
    assunto: 'fatos de membro',
    consequencia:
      'Sem o catálogo de fatos não é possível escolher o fato de membro que o agregado resume.',
    destino: () => document.getElementById(ID_DO_FATO_DE_MEMBRO),
  });

  protected readonly cardinalidades = CARDINALIDADES;
  protected readonly fontes = FONTES_DE_VALORES;
  protected readonly formatos = FORMATOS_DE_TEXTO;
  protected readonly escopos = ESCOPOS;
  protected readonly componentes = COMPONENTES_DE_EXIBICAO;
  protected readonly rotuloDoPadrao = ROTULO_DO_COMPONENTE_PADRAO;
  protected readonly resumo = resumoDoAgregado;

  protected readonly erro = this.edicao.erro;
  protected readonly anuncio = this.edicao.anuncioDaCriacao;
  protected readonly fatosDeMembro = computed(() => fatosDeMembroAgregaveis(this.catalogo.itens()));
  protected readonly membroEscolhido = computed(
    () =>
      this.fatosDeMembro().find((fato) => fato.codigo === this.dep.valores().fatoDeMembro) ?? null,
  );
  protected readonly rotuloDoBotao = computed(() =>
    this.salvando() ? 'Criando...' : 'Criar fato',
  );

  private readonly foco = acompanharFocoDoEnvio({
    salvando: this.salvando,
    aberto: this.edicao.aberto,
  });

  protected erroDoCampo(campo: CampoDaCriacao): string | null {
    return mensagemDoCampo(this.form.controls[campo]);
  }

  protected nomeDaFase(codigo: string): string {
    return this.fases.itens().find((fase) => fase.codigo === codigo)?.nome ?? codigo;
  }

  protected cancelar(): void {
    this.edicao.fechar();
  }

  protected aoClicarEmCriar(evento: Event): void {
    bloquearEnvio(evento, this.salvando());
  }

  protected aoEnviar(): void {
    this.edicao.criar();
    if (this.form.invalid) this.foco.focarPrimeiroInvalido();
  }
}
