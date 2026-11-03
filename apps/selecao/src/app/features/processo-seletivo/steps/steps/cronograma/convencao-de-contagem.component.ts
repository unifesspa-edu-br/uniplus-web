import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';
import { FormsModule } from '@angular/forms';
import { CatalogosDoCronogramaService } from './catalogos-do-cronograma.service';
import { baseLegalDaConvencao, invariantesDaConvencao } from './convencao-de-contagem';
import { FormularioDoCronograma } from './servicos/formulario-do-cronograma.service';
import { GravacaoDoCronograma } from './servicos/gravacao-do-cronograma.service';

/** A convenção de contagem de prazo do processo: o que o catálogo oferece e o que cada uma garante. */
@Component({
  selector: 'div[selConvencaoDeContagem]',
  imports: [ValorLegivelDirective, FormsModule],
  templateUrl: './convencao-de-contagem.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConvencaoDeContagemComponent {
  private readonly catalogos = inject(CatalogosDoCronogramaService);
  protected readonly cronograma = inject(FormularioDoCronograma);
  protected readonly gravacao = inject(GravacaoDoCronograma);
  protected readonly edicaoLiberada = this.cronograma.edicaoLiberada;
  protected readonly formulario = this.cronograma.formulario;
  protected readonly algoritmoDeclaradoNoServidor = this.gravacao.algoritmoDeclaradoNoServidor;

  /**
   * Convenções de contagem de prazo publicadas no catálogo versionado. O DTO
   * não tem `nome` nem `descricao` — só `codigo`, `versao` e `baseLegal` são
   * legíveis, e é isso que o seletor exibe. Nenhum mapa código→rótulo é
   * escrito aqui: seria vocabulário institucional duplicado no frontend.
   */
  readonly regrasDeContagem = computed(() =>
    this.catalogos
      .regrasContagem()
      .map((regra) => ({ codigo: regra.codigo, versao: regra.versao, baseLegal: regra.baseLegal })),
  );

  readonly invariantesDaContagem = computed<readonly string[]>(() => {
    this.cronograma.versao();
    return invariantesDaConvencao(
      this.catalogos.regrasContagem(),
      this.cronograma.formulario.controls.algoritmoContagemCodigo.value,
    );
  });

  readonly baseLegalDaContagem = computed<string>(() => {
    this.cronograma.versao();
    return baseLegalDaConvencao(
      this.catalogos.regrasContagem(),
      this.cronograma.formulario.controls.algoritmoContagemCodigo.value,
    );
  });

  /**
   * A convenção é identificada por código **e** versão: publicar versão nova
   * do catálogo não pode mudar a regra que um processo já declarou. Escolher
   * pelo código e deduzir a versão do que está carregado é o que mantém o par
   * coerente — gravar código novo com versão velha é recusado.
   */
  escolherAlgoritmo(codigo: string): void {
    const versao = this.regrasDeContagem().find((regra) => regra.codigo === codigo)?.versao ?? '';
    this.cronograma.formulario.controls.algoritmoContagemCodigo.setValue(codigo);
    this.cronograma.formulario.controls.algoritmoContagemVersao.setValue(versao);
    // O valor de um FormControl não é signal: sem avisar, a descrição da convenção
    // escolhida continuaria mostrando a anterior.
    this.cronograma.versao.update((versaoAtual) => versaoAtual + 1);
  }

  // ── O que a etapa publica ──────────────────────────────────────────────────
  // Mesmo desenho que a fase já usa um nível acima: a coleção é substituída por
  // inteiro, e trocar o ato zera o papel, porque só ato que o catálogo marca como
  // resultado o recebe.
}
