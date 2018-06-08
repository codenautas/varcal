"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function alias(context) {
    var admin = context.user.rol === 'admin';
    return {
        name: 'alias',
        elementName: 'alias',
        editable: admin,
        fields: [
            { name: "operativo", typeName: 'text', },
            { name: "alias", typeName: 'text', },
            { name: "tabla_datos", typeName: 'text', nullable: false },
            { name: "where", typeName: 'text' },
            { name: "on", typeName: 'text', nullable: false },
            { name: "descripcion", typeName: 'text', },
        ],
        primaryKey: ['operativo', 'alias'],
        foreignKeys: [
            { references: 'operativos', fields: ['operativo'] },
            { references: 'tabla_datos', fields: ['operativo', 'tabla_datos'] },
        ],
    };
}
exports.alias = alias;
//# sourceMappingURL=table-alias.js.map