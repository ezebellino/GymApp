## ADDED Requirements

### Requirement: Preferencia de tema visual propia de cada usuario
Cada usuario autenticado (Dueño, Coach o cliente del portal) SHALL tener su propia preferencia de
modo de tema (dark o light) del tema único "Kinetic Obsidian", independiente de la de cualquier
otro usuario y de la configuración del negocio. El modo elegido SHALL aplicarse a toda la app de
inmediato al cambiarlo, sin recargar la página, y SHALL seguir aplicado en la siguiente carga y en
cualquier dispositivo donde ese usuario vuelva a iniciar sesión.

#### Scenario: Cambiar el propio modo de tema
- **WHEN** un usuario logueado (cualquier rol) alterna entre modo dark y modo light
- **THEN** la apariencia de la app cambia de inmediato en toda la pantalla, incluidos menú
  lateral, barra superior y contenido de la vista

#### Scenario: El modo sobrevive a recargar
- **WHEN** el usuario cambia su modo de tema y recarga la página
- **THEN** la app se muestra con el modo elegido desde el primer render, sin destello del modo
  anterior

#### Scenario: El modo sigue al usuario, no al dispositivo
- **WHEN** el usuario elige un modo de tema en un dispositivo y después inicia sesión con la misma
  cuenta en otro dispositivo distinto
- **THEN** ve la app con el mismo modo que eligió antes, sin tener que volver a elegirlo

#### Scenario: Dos usuarios logueados al mismo tiempo no se pisan
- **WHEN** el Dueño y un Coach del mismo gimnasio están logueados al mismo tiempo (en la misma
  sesión de navegador o en dispositivos distintos) y cada uno elige un modo de tema distinto
- **THEN** cada uno ve la app en el modo que eligió, sin que el cambio de uno afecte lo que ve el
  otro

#### Scenario: Usuario existente sin preferencia guardada
- **WHEN** un usuario que ya existía antes de este cambio inicia sesión por primera vez después de
  desplegado
- **THEN** ve la app en un modo por defecto razonable (dark), sin error ni pantalla rota, hasta que
  elige su propio modo
