import {
  type AvaliacaoNaTela,
  type ModalidadesAvaliadas,
  nomesNaOrdem,
  type PendenciaDaAvaliacao,
} from './modalidades-avaliadas';

export interface BlocoDeOpcao {
  readonly chave: 'unica' | 'primeira' | 'segunda';
  readonly titulo: string | null;
  readonly situacao: string | null;
  readonly nomes: readonly string[];
  readonly pendencias: readonly PendenciaDaAvaliacao[];
}

function tituloDaOpcao(opcao: string, curso: string | null | undefined): string {
  return curso ? `${opcao} — ${curso}` : opcao;
}

function blocoDe(
  chave: BlocoDeOpcao['chave'],
  titulo: string | null,
  modalidades: ModalidadesAvaliadas | null,
): BlocoDeOpcao {
  return {
    chave,
    titulo,
    situacao: modalidades?.situacao ?? null,
    nomes: nomesNaOrdem(modalidades),
    pendencias: modalidades?.pendencias ?? [],
  };
}

function semPendenciasRepetidas(segunda: BlocoDeOpcao, primeira: BlocoDeOpcao): BlocoDeOpcao {
  const jaPedidas = new Set(primeira.pendencias.map((pendencia) => pendencia.fatoCodigo));
  return {
    ...segunda,
    pendencias: segunda.pendencias.filter((pendencia) => !jaPedidas.has(pendencia.fatoCodigo)),
  };
}

export function blocosDasOpcoes(avaliacao: AvaliacaoNaTela): readonly BlocoDeOpcao[] {
  const { modalidades, modalidadesSegundaOpcao, opcoesDeCurso } = avaliacao;
  if (!modalidadesSegundaOpcao) return [blocoDe('unica', null, modalidades)];
  const primeira = blocoDe(
    'primeira',
    tituloDaOpcao('1ª opção', opcoesDeCurso?.primeira),
    modalidades,
  );
  const segunda = blocoDe(
    'segunda',
    tituloDaOpcao('2ª opção', opcoesDeCurso?.segunda),
    modalidadesSegundaOpcao,
  );
  return [primeira, semPendenciasRepetidas(segunda, primeira)];
}
