## ADDED Requirements

### Requirement: Contraste legible en los campos de usuario y contraseña
Los campos "Usuario" y "Contraseña" del formulario de login SHALL mostrar su texto con
contraste suficiente para ser legible sobre el fondo del input, en todos sus estados: vacío, con
texto tipeado manualmente, con foco, y con autocompletado del navegador (incluyendo sugerencias
ofrecidas por un gestor de contraseñas).

#### Scenario: Texto tipeado manualmente
- **WHEN** el usuario tipea su nombre de usuario en el campo "Usuario"
- **THEN** el texto se muestra con contraste suficiente para leerse claramente sobre el fondo
  del input (no texto oscuro sobre fondo oscuro)

#### Scenario: Campo con foco antes de tipear
- **WHEN** el usuario hace foco en el campo "Usuario" o "Contraseña" sin haber tipeado nada
  todavía
- **THEN** el input mantiene contraste suficiente entre su fondo y su contenido (placeholder o
  texto), sin cambiar a un color que dificulte la lectura

#### Scenario: Autocompletado del navegador o gestor de contraseñas
- **WHEN** el navegador autocompleta el campo "Usuario" o "Contraseña" (por historial de
  autocompletado o por un gestor de contraseñas) y el usuario selecciona una sugerencia
- **THEN** el valor autocompletado se muestra con el mismo contraste legible que el texto
  tipeado manualmente, en cualquier estado de foco
