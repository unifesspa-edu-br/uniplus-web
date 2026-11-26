export class CamposPostosPelasExigencias {
  private constructor(private readonly codigos: ReadonlySet<string>) {}

  static vazia(): CamposPostosPelasExigencias {
    return new CamposPostosPelasExigencias(new Set());
  }

  comOsQueEntraram(codigos: readonly string[]): CamposPostosPelasExigencias {
    if (codigos.every((codigo) => this.codigos.has(codigo))) return this;
    return new CamposPostosPelasExigencias(new Set([...this.codigos, ...codigos]));
  }

  soOsPresentes(presentes: ReadonlySet<string>): CamposPostosPelasExigencias {
    return new CamposPostosPelasExigencias(
      new Set([...this.codigos].filter((codigo) => presentes.has(codigo))),
    );
  }

  esvaziada(): CamposPostosPelasExigencias {
    return CamposPostosPelasExigencias.vazia();
  }

  contem(codigo: string): boolean {
    return this.codigos.has(codigo);
  }
}
