import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
  type CondicaoEmClausula,
  EditorDeCondicoesComponent,
} from '@uniplus/shared-ui/components';
import { EdicaoDoFato } from './edicao-do-fato';
import { ID_DAS_REGRAS_PADRAO } from './ids-do-fato';

/** As regras padrão do derivado: o valor que cada uma acrescenta e as condições em que vale. */
@Component({
  selector: 'cfg-fato-regras',
  imports: [AlertaNovaTentativaComponent, EditorDeCondicoesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-regras.component.html',
  styleUrl: './fato-edicao.css',
})
export class FatoRegrasComponent {
  private readonly edicao = inject(EdicaoDoFato);

  protected readonly leitura = this.edicao.leitura;
  protected readonly fato = this.leitura.fato;
  protected readonly bloqueado = this.edicao.bloqueado;
  protected readonly regras = this.edicao.regras;
  protected readonly novaTentativaDoCatalogo = acompanharNovaTentativa({
    assunto: 'catálogo de fatos',
    pendente: this.leitura.catalogo.pendente,
    falhou: this.leitura.catalogo.falhou,
    destino: () => document.getElementById(ID_DAS_REGRAS_PADRAO),
  });

  protected tentarCatalogoNovamente(): void {
    this.novaTentativaDoCatalogo.executar(() => this.leitura.catalogo.recarregar());
  }

  protected opcoesDeContribuicao(
    contribui: string | null,
  ): readonly { valor: string; rotulo: string }[] {
    const ativos = this.leitura.valoresAtivos().map((valor) => ({ valor, rotulo: valor }));
    return contribui && !this.leitura.valoresAtivos().includes(contribui)
      ? [{ valor: contribui, rotulo: `${contribui} (desativado)` }, ...ativos]
      : ativos;
  }

  protected trocarContribuicao(indice: number, evento: Event): void {
    this.regras.trocarContribuicao(indice, (evento.target as HTMLSelectElement).value);
  }

  protected trocarCondicoes(indice: number, condicoes: readonly CondicaoEmClausula[]): void {
    this.regras.trocarCondicoes(indice, condicoes);
  }

  protected acrescentar(): void {
    this.edicao.acrescentarRegra();
  }

  protected salvar(): void {
    this.edicao.salvarRegras();
  }
}
