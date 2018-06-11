export * from 'operativos';
export interface AliasDefEst {
    on: string;
    tabla_datos: string;
    where?: string;
}
export interface Alias extends AliasDefEst {
    operativo: string;
    alias: string;
    descripcion?: string;
}
