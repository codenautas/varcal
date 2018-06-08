export * from 'operativos';
export interface Alias {
    operativo: string;
    alias: string;
    tabla_datos: string;
    where: string;
    on: string;
    descripcion: string;
}
