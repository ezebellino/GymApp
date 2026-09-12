// Único lugar del repo donde vive el nombre de la app de cara al usuario.
// Antes estaba hardcodeado con drift ("Mini Espacio" en unos archivos, "Gym
// App" en otros); ahora sale de `VITE_APP_NAME` con "Gym App" como fallback,
// así un deploy que no defina la variable no muestra un placeholder vacío.
export const APP_NAME = import.meta.env.VITE_APP_NAME?.trim() || "Gym App";
