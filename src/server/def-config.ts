export const defConfig=`
server:
  port: 3032
  base-url: /varcal
  session-store: memory
db:
  motor: postgresql
  host: localhost
  database: varcal_db
  schema: varcal
  user: varcal_user
install:
  dump:
    db:
      owner: varcal_owner
    admin-can-create-tables: true
    enances: inline
    skip-content: true
    scripts:
      post-adapt: 
      - para-install.sql
      - wrappers.sql
      - ../node_modules/pg-triggers/lib/recreate-his.sql
      - ../node_modules/pg-triggers/lib/table-changes.sql
      - ../node_modules/pg-triggers/lib/function-changes-trg.sql
      - ../node_modules/pg-triggers/lib/enance.sql
login:
  table: usuarios
  userFieldName: usuario
  passFieldName: md5clave
  rolFieldName: rol
  infoFieldList: [usuario, rol]
  activeClausule: activo
  plus:
    maxAge-5-sec: 5000    
    maxAge: 864000000
    maxAge-10-day: 864000000
    allowHttpLogin: true
    fileStore: false
    skipCheckAlreadyLoggedIn: true
    loginForm:
      formTitle: VarCal
      usernameLabel: usuario
      passwordLabel: md5clave
      buttonLabel: entrar
      formImg: img/login-lock-icon.png
    chPassForm:
      usernameLabel: usuario
      oldPasswordLabel: clave anterior
      newPasswordLabel: nueva clave
      repPasswordLabel: repetir nueva clave
      buttonLabel: Cambiar
      formTitle: Cambio de clave
  messages:
    userOrPassFail: el nombre de usuario no existe o la clave no corresponde
    lockedFail: el usuario se encuentra bloqueado
    inactiveFail: es usuario está marcado como inactivo
client-setup:
  cursors: true
  lang: es
  menu: true
`;