import type { FormGroup } from '@angular/forms';

import type { ProdutoDaFase } from '../../processo-seletivo.models';
import type { EtapaForm } from './cronograma-form';

// A coleção é substituída por inteiro, e trocar o ato zera o papel, porque só ato que o
// catálogo marca como resultado o recebe.

export function acrescentarProduto(grupo: FormGroup<EtapaForm>): void {
  escreverProdutos(grupo, [...grupo.controls.produtos.value, { atoCodigo: '', papel: null }]);
}

export function removerProduto(grupo: FormGroup<EtapaForm>, posicao: number): void {
  escreverProdutos(
    grupo,
    grupo.controls.produtos.value.filter((_, indice) => indice !== posicao),
  );
}

export function escolherAtoDoProduto(
  grupo: FormGroup<EtapaForm>,
  posicao: number,
  atoCodigo: string,
): void {
  escreverProdutos(
    grupo,
    grupo.controls.produtos.value.map((produto, indice) =>
      indice === posicao ? { atoCodigo, papel: null } : produto,
    ),
  );
}

export function escolherPapelDoProduto(
  grupo: FormGroup<EtapaForm>,
  posicao: number,
  papel: string,
): void {
  const escolhido = papel === '' ? null : (papel as ProdutoDaFase['papel']);
  escreverProdutos(
    grupo,
    grupo.controls.produtos.value.map((produto, indice) =>
      indice === posicao ? { ...produto, papel: escolhido } : produto,
    ),
  );
}

function escreverProdutos(grupo: FormGroup<EtapaForm>, produtos: readonly ProdutoDaFase[]): void {
  // `valueChanges` do formulário já propaga para o rascunho e incrementa a versão —
  // não há o que marcar aqui além do próprio controle.
  grupo.controls.produtos.setValue(produtos);
  grupo.controls.produtos.markAsDirty();
}
