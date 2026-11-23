import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  acompanharLeitura,
  FalhaDeLeituraDoCampoComponent,
  IndicadorDaLeituraDirective,
  RecusaDoCampoComponent,
  type RecusaDoCampo,
} from '@uniplus/shared-ui/components';
import type { FormaDeComprovacaoDto } from '@uniplus/shared-data/selecao';

import type { RegraDeComprovacao } from '../../../processo-seletivo.models';

export interface DocumentoDoGrupo {
  readonly identificador: string;
  readonly nome: string;
}

type FormaDoGrupo = 'TODOS_OS_ITENS' | 'QUANTIDADE_MINIMA_DE_ITENS';

@Component({
  selector: 'sel-grupo-de-documentos',
  imports: [FalhaDeLeituraDoCampoComponent, IndicadorDaLeituraDirective, RecusaDoCampoComponent],
  templateUrl: './grupo-de-documentos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrupoDeDocumentosComponent {
  readonly grupo = input.required<RegraDeComprovacao>();
  readonly recusasDaQuantidade = input<readonly RecusaDoCampo[]>([]);
  readonly itens = input.required<readonly DocumentoDoGrupo[]>();
  readonly disponiveis = input.required<readonly DocumentoDoGrupo[]>();
  readonly formas = input.required<readonly FormaDeComprovacaoDto[]>();
  readonly situacao = input.required<'carregando' | 'pronto' | 'falhou'>();
  readonly erro = input<string | null>(null);
  readonly desabilitado = input(false);
  readonly formaChange = output<FormaDoGrupo>();
  readonly quantidadeChange = output<number>();
  readonly retirar = output<string>();
  readonly incluir = output<string>();
  readonly repetir = output<void>();
  private readonly anfitriao = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly leitura = acompanharLeitura({
    falha: this.erro,
    pendente: computed(() => this.situacao() === 'carregando'),
    recarregar: () => this.repetir.emit(),
    destino: () => this.anfitriao.nativeElement.querySelector<HTMLElement>('input[type=radio]'),
    assunto: 'as formas de comprovação',
  });
  readonly documentoEscolhido = signal('');
  readonly quantidadeDigitada = signal<string | null>(null);
  readonly formasDoGrupo = computed(() =>
    this.formas().filter((forma) => forma.codigo !== 'DOCUMENTO'),
  );
  readonly quantidadeInvalida = computed(() => {
    const digitada = this.quantidadeDigitada();
    const quantidade = digitada === null ? this.grupo().quantidadeMinima : Number(digitada);
    if (quantidade === null) return false;
    return (
      digitada?.trim() === '' ||
      !Number.isInteger(quantidade) ||
      quantidade < 1 ||
      quantidade > this.itens().length
    );
  });
  readonly resumo = computed(() => {
    const nomes = this.itens()
      .map((item) => item.nome)
      .join(', ');
    const quantidade = this.itens().length;
    const inicio =
      this.grupo().forma === 'TODOS_OS_ITENS'
        ? 'Todos estes'
        : this.grupo().quantidadeMinima === 1
          ? 'Um destes'
          : `Pelo menos ${this.grupo().quantidadeMinima} destes`;
    return `${inicio} ${quantidade} documentos: ${nomes}`;
  });

  escolherForma(forma: string): void {
    if (forma === 'TODOS_OS_ITENS' || forma === 'QUANTIDADE_MINIMA_DE_ITENS') {
      this.quantidadeDigitada.set(null);
      this.formaChange.emit(forma);
    }
  }

  escolherQuantidade(valor: string): void {
    this.quantidadeDigitada.set(valor);
    this.quantidadeChange.emit(Number(valor));
  }

  incluirEscolhido(): void {
    const identificador = this.documentoEscolhido();
    if (identificador === '') return;
    this.incluir.emit(identificador);
    this.documentoEscolhido.set('');
  }
}
