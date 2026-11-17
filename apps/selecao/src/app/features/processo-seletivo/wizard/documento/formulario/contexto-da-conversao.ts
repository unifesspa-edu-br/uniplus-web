import { localizacaoDaConversao } from './localizacao-da-conversao';
import type { ConteudoDoFormulario, NumeroDigitado } from '@uniplus/shared-ui/components';
import { membroDoEnum } from '../membro-do-enum';
import { CamposEmEdicao } from './campos-em-edicao';
import type {
  CatalogosDaConversaoDoFormulario,
  ImpedimentoDaConversaoDoFormulario,
} from './resultado-da-conversao';

const CAMPO_SEM_CORRESPONDENCIA =
  'O campo não tem uma correspondência única no catálogo. Carregue o catálogo novamente.';

type Assunto = 'catalogo' | 'termo' | 'versao' | 'numeros' | 'pressupostos' | 'campo';
const ASSUNTOS: readonly Assunto[] = [
  'catalogo',
  'termo',
  'versao',
  'numeros',
  'pressupostos',
  'campo',
];

export class ContextoDaConversao {
  private readonly problemas = new Map<Assunto, ImpedimentoDaConversaoDoFormulario[]>();
  constructor(
    readonly catalogos: CatalogosDaConversaoDoFormulario,
    readonly edicao: CamposEmEdicao,
    private readonly conteudo?: ConteudoDoFormulario,
  ) {}

  get impedimentos(): readonly ImpedimentoDaConversaoDoFormulario[] {
    return ASSUNTOS.flatMap((assunto) => this.problemas.get(assunto) ?? []);
  }

  recusar(assunto: Assunto, caminho: readonly string[], mensagem: string): undefined {
    const atual = this.problemas.get(assunto) ?? [];
    const ponteiro = localizacaoDaConversao(caminho, this.conteudo);
    this.problemas.set(assunto, [...atual, { caminho: ponteiro, mensagem }]);
    return undefined;
  }

  escolha<E extends Record<string, string>>(
    membros: E,
    valor: string,
    caminho: readonly string[],
  ): E[keyof E] | undefined {
    return (
      membroDoEnum(membros, valor) ?? this.recusar('campo', caminho, 'Selecione uma opção válida.')
    );
  }

  numero(
    valor: NumeroDigitado | null | undefined,
    caminho: readonly string[],
    inteiro = false,
  ): number | undefined {
    if (valor === null || valor === undefined) return undefined;
    const numero = Number(valor);
    const valido =
      String(valor).trim() !== '' &&
      Number.isFinite(numero) &&
      (!inteiro || Number.isInteger(numero));
    return valido ? numero : this.recusar('numeros', caminho, 'Informe um número válido.');
  }

  tipoDoCampo(codigo: string, caminho: readonly string[]): string | undefined {
    if (this.catalogos.fatos === null)
      return this.recusar(
        'catalogo',
        caminho,
        'Carregue novamente o catálogo de campos para editar o formulário.',
      );
    const fatos = this.catalogos.fatos.filter((fato) => fato.codigo === codigo);
    return fatos.length === 1
      ? fatos[0].tipoRenderizacao
      : this.recusar('catalogo', caminho, CAMPO_SEM_CORRESPONDENCIA);
  }
}
