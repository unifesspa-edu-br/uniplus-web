import { seletorDoCampo } from './seletor-do-campo.testing';
import { type Pagina, urlDoFato } from './fatos-candidato.testing';
import { corRaca } from './fatos-candidato.fixtures';

export const campo = (nome: string): string => seletorDoCampo(nome);
export const DESCRITIVO = '#cfg-fato-descritivo';
export const botaoDoValor = (codigo: string, acao: string): string =>
  `#cfg-fato-valor-${codigo}-${acao}`;

/** Conduz o envio do nome, da descrição e do componente, sobre a página que o teste montou. */
export class ConducaoDoDescritivo {
  constructor(private readonly pagina: () => Pagina) {}

  readonly salvarDescritivo = async (): Promise<void> => {
    const p = this.pagina();
    p.submeter(DESCRITIVO);
    await p.propagar();
  };

  readonly putDoFato = () =>
    this.pagina().http.expectOne((r) => r.method === 'PUT' && r.url === urlDoFato(corRaca));
}
