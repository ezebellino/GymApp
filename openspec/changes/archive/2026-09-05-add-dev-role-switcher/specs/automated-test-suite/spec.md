## ADDED Requirements

### Requirement: Test de render del widget de cambio de rol según modo de build
La suite de frontend SHALL incluir al menos un test que verifique que el widget de cambio de rol
(capability `dev-role-switcher`) se renderiza cuando el entorno es de desarrollo y que no se
renderiza (o el módulo no se importa) cuando el entorno simulado es de producción.

#### Scenario: Se renderiza en modo desarrollo
- **WHEN** el test renderiza el shell de la app simulando modo de desarrollo
- **THEN** encuentra el widget de cambio de rol en el árbol renderizado

#### Scenario: No se renderiza en modo producción
- **WHEN** el test renderiza el shell de la app simulando modo de producción
- **THEN** no encuentra el widget de cambio de rol ni ningún rastro de sus tres opciones de
  usuario en el árbol renderizado
