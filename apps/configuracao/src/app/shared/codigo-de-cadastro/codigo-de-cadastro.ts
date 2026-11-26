import { signal, type Signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { formarCodigoDoNome } from '@uniplus/shared-utils';

export interface CamposDoCodigoDeCadastro {
  readonly nome: FormControl<string>;
  readonly codigo: FormControl<string>;
}

export interface CodigoDeCadastroLigado {
  readonly avisoDoNome: Signal<string>;
  reiniciar(): void;
}

class SugestorDeCodigo {
  private ultimaSugestao = '';
  readonly avisoDoNome = signal('');

  constructor(
    private readonly codigo: FormControl<string>,
    private readonly limite: number,
  ) {}

  sugerirPara(nome: string): void {
    if (this.codigo.value !== '' && this.codigo.value !== this.ultimaSugestao) return;
    const resultado = formarCodigoDoNome(nome, this.limite);
    this.ultimaSugestao = resultado?.ok ? resultado.codigo : '';
    this.codigo.setValue(this.ultimaSugestao, { emitEvent: false });
    this.avisoDoNome.set(
      resultado && !resultado.ok
        ? `O código formado a partir deste nome passa de ${this.limite} caracteres. Use um nome mais curto.`
        : '',
    );
  }

  reiniciar(): void {
    this.ultimaSugestao = '';
    this.avisoDoNome.set('');
  }
}

export function ligarCodigoDeCadastro(
  campos: CamposDoCodigoDeCadastro,
  emCriacao: () => boolean,
  limite: number,
): CodigoDeCadastroLigado {
  const sugestor = new SugestorDeCodigo(campos.codigo, limite);
  campos.nome.valueChanges.pipe(takeUntilDestroyed()).subscribe((nome) => {
    if (emCriacao()) sugestor.sugerirPara(nome);
  });
  campos.codigo.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(() => sugestor.avisoDoNome.set(''));
  return sugestor;
}
