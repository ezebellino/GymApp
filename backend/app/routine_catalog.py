TRAINING_DAYS = [
    {
        "id": "day-1",
        "name": "Dia 1",
        "muscle_groups": ["Pecho", "Triceps"],
        "default_active_ids": [
            "chest-bench-press",
            "chest-incline-dumbbell-press",
            "chest-cable-fly",
            "triceps-close-grip-bench",
            "triceps-pushdown",
            "triceps-overhead-extension",
        ],
    },
    {
        "id": "day-2",
        "name": "Dia 2",
        "muscle_groups": ["Espalda", "Biceps"],
        "default_active_ids": [
            "back-lat-pulldown",
            "back-single-arm-row",
            "back-tbar-row",
            "biceps-barbell-curl",
            "biceps-hammer-curl",
            "biceps-preacher-curl",
        ],
    },
    {
        "id": "day-3",
        "name": "Dia 3",
        "muscle_groups": ["Hombros"],
        "default_active_ids": [
            "shoulders-lateral-raise",
            "shoulders-front-raise",
            "shoulders-arnold-press",
            "shoulders-rear-delt-fly",
            "shoulders-overhead-press",
            "shoulders-dumbbell-press",
        ],
    },
    {
        "id": "day-4",
        "name": "Dia 4",
        "muscle_groups": ["Piernas"],
        "default_active_ids": [
            "legs-back-squat",
            "legs-goblet-squat",
            "legs-leg-extension",
            "legs-romanian-deadlift",
            "legs-box-step-up",
            "legs-standing-calf-raise",
        ],
    },
]


# Base por defecto (series x reps · kg) para los ejercicios sin un equivalente directo
# en el prototipo relevado (`docs/propuestas/rutinas-descripcion-funcional.md` §5.2):
# misma base por defecto que ya usa el schema para un ejercicio sin base indicada
# (`add-routine-templates`, design D3).
_DEFAULT_BASE = {"base_sets": 3, "base_reps": 10, "base_weight_kg": 0}

EXERCISE_LIBRARY = [
    # --- Espalda ---------------------------------------------------------
    {"id": "back-lat-pulldown", "name": "Tirones en polea alta agarre amplio", "muscle_group": "Espalda",
     "base_sets": 3, "base_reps": 12, "base_weight_kg": 40},  # equivalente a "Jalón al pecho" del prototipo
    {"id": "back-single-arm-row", "name": "Remo a 1 mano", "muscle_group": "Espalda", **_DEFAULT_BASE},
    {"id": "back-tbar-row", "name": "Remo potro Landmine", "muscle_group": "Espalda", **_DEFAULT_BASE},
    {"id": "back-seated-row", "name": "Remo bajo", "muscle_group": "Espalda", **_DEFAULT_BASE},
    {"id": "back-single-leg-row", "name": "Remo bajo unipodal", "muscle_group": "Espalda", **_DEFAULT_BASE},
    {"id": "back-supinated-pulldown", "name": "Tirones polea alta con agarre supino", "muscle_group": "Espalda",
     **_DEFAULT_BASE},
    {"id": "back-barbell-row", "name": "Remo con barra", "muscle_group": "Espalda",
     "base_sets": 4, "base_reps": 10, "base_weight_kg": 38},  # equivalente directo del prototipo
    {"id": "back-triangle-pulldown", "name": "Tirones polea alta con triangulo", "muscle_group": "Espalda",
     **_DEFAULT_BASE},
    {"id": "back-pull-up", "name": "Dominadas", "muscle_group": "Espalda",
     "base_sets": 4, "base_reps": 6, "base_weight_kg": 20},  # equivalente a "Dominadas asistidas" del prototipo
    {"id": "back-behind-neck-pulldown", "name": "Tirones polea alta tras nuca", "muscle_group": "Espalda",
     **_DEFAULT_BASE},
    {"id": "back-straight-arm-pulldown", "name": "Pullover en polea alta", "muscle_group": "Espalda",
     **_DEFAULT_BASE},
    # --- Biceps ------------------------------------------------------------
    {"id": "biceps-barbell-curl", "name": "Curl barra", "muscle_group": "Biceps",
     "base_sets": 4, "base_reps": 10, "base_weight_kg": 22},  # equivalente a "Curl bíceps barra Z" del prototipo
    {"id": "biceps-incline-curl", "name": "Curl supinado banco inclinado", "muscle_group": "Biceps", **_DEFAULT_BASE},
    {"id": "biceps-hammer-curl", "name": "Curl martillo", "muscle_group": "Biceps",
     "base_sets": 3, "base_reps": 12, "base_weight_kg": 12},  # equivalente directo del prototipo
    {"id": "biceps-preacher-curl", "name": "Banco Scott", "muscle_group": "Biceps", **_DEFAULT_BASE},
    {"id": "biceps-concentration-curl", "name": "Concentrado con mancuerna", "muscle_group": "Biceps",
     **_DEFAULT_BASE},
    {"id": "biceps-spider-curl", "name": "Spiderman con barra o mancuerna", "muscle_group": "Biceps",
     **_DEFAULT_BASE},
    # --- Triceps -----------------------------------------------------------
    {"id": "triceps-close-grip-bench", "name": "Press barra angosta", "muscle_group": "Triceps", **_DEFAULT_BASE},
    {"id": "triceps-pushdown", "name": "Polea alta", "muscle_group": "Triceps",
     "base_sets": 3, "base_reps": 12, "base_weight_kg": 25},  # equivalente a "Extensión de tríceps en polea"
    {"id": "triceps-overhead-extension", "name": "Copa", "muscle_group": "Triceps", **_DEFAULT_BASE},
    {"id": "triceps-skullcrusher", "name": "Frances con barra W", "muscle_group": "Triceps", **_DEFAULT_BASE},
    {"id": "triceps-dumbbell-french-press", "name": "Frances con mancuernas", "muscle_group": "Triceps",
     **_DEFAULT_BASE},
    {"id": "triceps-rope-pushdown", "name": "Polea alta con soga", "muscle_group": "Triceps", **_DEFAULT_BASE},
    # --- Hombros -------------------------------------------------------------
    {"id": "shoulders-lateral-raise", "name": "Vuelo lateral", "muscle_group": "Hombros",
     "base_sets": 4, "base_reps": 15, "base_weight_kg": 8},  # equivalente a "Elevaciones laterales" del prototipo
    {"id": "shoulders-front-raise", "name": "Vuelo frontal", "muscle_group": "Hombros", **_DEFAULT_BASE},
    {"id": "shoulders-arnold-press", "name": "Press Arnold", "muscle_group": "Hombros", **_DEFAULT_BASE},
    {"id": "shoulders-rear-delt-fly", "name": "Posteriores con mancuernas", "muscle_group": "Hombros",
     "base_sets": 3, "base_reps": 15, "base_weight_kg": 6},  # equivalente a "Pájaros" del prototipo
    {"id": "shoulders-overhead-press", "name": "Press militar con barra", "muscle_group": "Hombros",
     "base_sets": 4, "base_reps": 8, "base_weight_kg": 28},  # equivalente directo del prototipo
    {"id": "shoulders-dumbbell-press", "name": "Press militar con mancuerna", "muscle_group": "Hombros",
     **_DEFAULT_BASE},
    {"id": "shoulders-upright-row", "name": "Remo al menton agarre amplio con W", "muscle_group": "Hombros",
     **_DEFAULT_BASE},
    {"id": "shoulders-barbell-shrug", "name": "Encogimientos con barra", "muscle_group": "Hombros", **_DEFAULT_BASE},
    {"id": "shoulders-face-pull", "name": "Face pull", "muscle_group": "Hombros", **_DEFAULT_BASE},
    # --- Piernas -------------------------------------------------------------
    {"id": "legs-back-squat", "name": "Sentadilla libre", "muscle_group": "Piernas",
     "base_sets": 5, "base_reps": 5, "base_weight_kg": 70},  # equivalente directo del prototipo
    {"id": "legs-goblet-squat", "name": "Sentadilla goblet", "muscle_group": "Piernas", **_DEFAULT_BASE},
    {"id": "legs-leg-extension", "name": "Extensiones", "muscle_group": "Piernas", **_DEFAULT_BASE},
    {"id": "legs-romanian-deadlift", "name": "Peso muerto rumano", "muscle_group": "Piernas",
     "base_sets": 4, "base_reps": 10, "base_weight_kg": 55},  # equivalente directo del prototipo
    {"id": "legs-box-step-up", "name": "Subidas al cajon", "muscle_group": "Piernas", **_DEFAULT_BASE},
    {"id": "legs-standing-calf-raise", "name": "Gemelos", "muscle_group": "Piernas",
     "base_sets": 4, "base_reps": 20, "base_weight_kg": 40},  # equivalente a "Gemelos de pie" del prototipo
    {"id": "legs-bulgarian-split-squat", "name": "Bulgaras", "muscle_group": "Piernas", **_DEFAULT_BASE},
    {"id": "legs-walking-lunge", "name": "Estocadas", "muscle_group": "Piernas", **_DEFAULT_BASE},
    {"id": "legs-leg-press", "name": "Prensa a 45 grados", "muscle_group": "Piernas",
     "base_sets": 4, "base_reps": 12, "base_weight_kg": 120},  # equivalente a "Prensa 45°" del prototipo
    {"id": "legs-conventional-deadlift", "name": "Peso muerto convencional", "muscle_group": "Piernas",
     **_DEFAULT_BASE},
    {"id": "legs-leg-curl", "name": "Izquiotibiales en banco", "muscle_group": "Piernas", **_DEFAULT_BASE},
    {"id": "legs-sissy-squat", "name": "Sissy Squat", "muscle_group": "Piernas", **_DEFAULT_BASE},
    {"id": "legs-sumo-deadlift", "name": "Sumo", "muscle_group": "Piernas", **_DEFAULT_BASE},
    # --- Pecho ---------------------------------------------------------------
    {"id": "chest-bench-press", "name": "Press en banco plano con barra", "muscle_group": "Pecho",
     "base_sets": 4, "base_reps": 8, "base_weight_kg": 45},  # equivalente a "Press banca plano" del prototipo
    {"id": "chest-incline-dumbbell-press", "name": "Press en banco inclinado con barra", "muscle_group": "Pecho",
     **_DEFAULT_BASE},
    {"id": "chest-cable-fly", "name": "Apertura inclinadas con mancuernas", "muscle_group": "Pecho",
     "base_sets": 3, "base_reps": 12, "base_weight_kg": 14},  # equivalente a "Aperturas con mancuernas"
    {"id": "chest-front-raise-45", "name": "Elevaciones en banco 45 grados con mancuernas", "muscle_group": "Pecho",
     **_DEFAULT_BASE},
    {"id": "chest-pec-deck", "name": "Peck Deck", "muscle_group": "Pecho", **_DEFAULT_BASE},
    {"id": "chest-machine-press", "name": "Press banco plano con mancuernas", "muscle_group": "Pecho",
     **_DEFAULT_BASE},
    {"id": "chest-push-up", "name": "Push ups", "muscle_group": "Pecho", **_DEFAULT_BASE},
]
