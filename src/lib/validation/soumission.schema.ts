import { z } from 'zod';

export const reponseSchema = z
  .object({
    questionId: z.string().uuid(),
    valeurNumerique: z.number().optional(),
    valeurTexte: z.string().max(5000).optional(),
    valeurOptions: z.unknown().optional(),
  })
  .refine(
    (r) => r.valeurNumerique !== undefined || r.valeurTexte !== undefined || r.valeurOptions !== undefined,
    { message: 'Chaque réponse doit porter au moins une valeur.' },
  );

export const soumissionSchema = z.object({
  questionnaireId: z.string().uuid(),
  reponses: z.array(reponseSchema).min(1),
});

export type SoumissionInput = z.infer<typeof soumissionSchema>;
