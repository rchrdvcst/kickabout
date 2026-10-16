import { z } from 'zod';

export const optionsSchema = z.object({
  consolationFinal: z.boolean().optional(),
  grandFinalReset: z.boolean().optional(),
  roundRobinMode: z.enum(['simple', 'double']).optional(),
});

export interface TournamentOptions {
  consolationFinal: boolean;
  grandFinalReset: boolean;
  roundRobinMode: 'simple' | 'double';
}

export const normalizeOptions = (input: z.infer<typeof optionsSchema> = {}): TournamentOptions => ({
  consolationFinal: input.consolationFinal ?? false,
  grandFinalReset: input.grandFinalReset ?? false,
  roundRobinMode: input.roundRobinMode ?? 'simple',
});
