import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AlertComponent, RecolhivelComponent } from '@uniplus/shared-ui/components';
import { novaTentativaAnunciada } from '../../shared/foco';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import {
  CLASSIFICACOES_DE_PROTECAO,
  HIPOTESES_LEGAIS,
  rotuloDe,
} from '../../shared/protecao-do-catalogo';
import { bloquearEnvio } from './bloquear-envio';
import { EdicaoDoFato } from './edicao-do-fato';
import { eixosSomenteLeitura } from './eixos-somente-leitura';
import { FatoProtecaoDaDefinicaoComponent } from './fato-protecao-da-definicao.component';
import {
  CARDINALIDADES,
  COMPONENTES_DE_EXIBICAO,
  DOMINIOS,
  ESCOPOS,
  FONTES_DE_VALORES,
  FORMATOS_DE_TEXTO,
  ORIGENS,
  ROTULO_DO_COMPONENTE_PADRAO,
} from './fato-candidato.regras';
import { ID_DO_PONTO_DE_RESOLUCAO_DA_DEFINICAO, ID_DO_SALVAR_DA_DEFINICAO } from './ids-do-fato';

type CampoDaDefinicao = keyof EdicaoDoFato['definicao']['controls'];

/**
 * A definição do fato: o que o tipo dele deixa editar, a proteção de dados e as recusas da API.
 * O fato de sistema só altera a proteção; os demais fatos só leem.
 */
@Component({
  selector: 'cfg-fato-definicao',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    AlertComponent,
    FatoProtecaoDaDefinicaoComponent,
    RecolhivelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-definicao.component.html',
  styleUrl: './fato-edicao.css',
})
export class FatoDefinicaoComponent {
  private readonly edicao = inject(EdicaoDoFato);

  protected readonly leitura = this.edicao.leitura;
  protected readonly fato = this.leitura.fato;
  protected readonly form = this.edicao.definicao;
  protected readonly dep = this.edicao.dependencias;
  protected readonly bloqueado = this.edicao.bloqueado;
  protected readonly citacoes = this.edicao.citacoes;
  protected readonly recusa = this.edicao.recusaDaDefinicao;
  protected readonly fases = this.leitura.fases;
  /** O alerta mantido na tela durante a tentativa não muda de texto; esta região anuncia cada tentativa. */
  protected readonly anuncioDaLeitura = signal('');
  private readonly novaTentativaDasFases = novaTentativaAnunciada({
    nome: 'fases',
    pendente: this.fases.pendente,
    falhou: this.fases.falhou,
    destino: () => document.getElementById(ID_DO_PONTO_DE_RESOLUCAO_DA_DEFINICAO),
    anuncio: this.anuncioDaLeitura,
  });
  protected readonly eixosSomenteLeitura = computed(() =>
    eixosSomenteLeitura(this.fato(), this.leitura.tipo()),
  );

  protected readonly idDoSalvar = ID_DO_SALVAR_DA_DEFINICAO;
  protected readonly origens = ORIGENS;
  protected readonly dominios = DOMINIOS;
  protected readonly cardinalidades = CARDINALIDADES;
  protected readonly fontes = FONTES_DE_VALORES;
  protected readonly formatos = FORMATOS_DE_TEXTO;
  protected readonly escopos = ESCOPOS;
  protected readonly componentes = COMPONENTES_DE_EXIBICAO;
  protected readonly rotuloDoPadrao = ROTULO_DO_COMPONENTE_PADRAO;
  protected readonly classificacoes = CLASSIFICACOES_DE_PROTECAO;
  protected readonly hipoteses = HIPOTESES_LEGAIS;
  protected readonly rotulo = rotuloDe;

  protected erroDoCampo(campo: CampoDaDefinicao): string | null {
    return mensagemDeErroDoControle(this.form.controls[campo]);
  }

  protected descritor(campo: CampoDaDefinicao): string | null {
    return this.erroDoCampo(campo) ? `cfg-fato-def-${campo}-erro` : null;
  }

  protected tentarFasesNovamente(): void {
    this.novaTentativaDasFases.executar(() => this.fases.recarregar());
  }

  protected salvar(): void {
    this.edicao.salvarDefinicao();
  }

  protected aoClicarEmSalvar(evento: Event): void {
    bloquearEnvio(evento, this.bloqueado());
  }
}
