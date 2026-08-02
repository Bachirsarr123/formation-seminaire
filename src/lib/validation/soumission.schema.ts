import { z } from 'zod';

// Les deux seules formes valides de valeurOptions (lib/questionnaire/echelles.ts) :
// { choix: [...] } pour QCM_UNIQUE/QCM_MULTIPLE, { sansOpinion: true } pour une
// échelle répondue « sans opinion ». Jamais une valeur arbitraire.
const valeurOptionsSchema = z.union([
  z.object({ choix: z.array(z.string()) }),
  z.object({ sansOpinion: z.literal(true) }),
]);

export const reponseSchema = z
  .object({
    questionId: z.string().uuid(),
    valeurNumerique: z.number().optional(),
    valeurTexte: z.string().max(5000).optional(),
    valeurOptions: valeurOptionsSchema.optional(),
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
