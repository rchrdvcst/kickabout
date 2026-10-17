import { GROUP_COUNTS } from '@kickabout/shared';
import { z } from 'zod';

export const optionsSchema = z.object({
  consolationFinal: z.boolean().optional(),
  grandFinalReset: z.boolean().optional(),
  roundRobinMode: z.enum(['simple', 'double']).optional(),
  groupCount: z
    .number()
    .int()
    .refine((count) => GROUP_COUNTS.includes(count), 'O número de grupos precisa ser 2, 4, 8, 16, 32 ou 64.')
    .optional(),
  qualifiersPerGroup: z.number().int().min(1).max(63).optional(),
});

export interface TournamentOptions {
  consolationFinal: boolean;
  grandFinalReset: boolean;
  roundRobinMode: 'simple' | 'double';
  /** Copa: número de grupos. */
  groupCount: number;
  /** Copa: quantos de cada grupo vão para o mata-mata. */
  qualifiersPerGroup: number;
}

export const normalizeOptions = (input: z.infer<typeof optionsSchema> = {}): TournamentOptions => ({
  consolationFinal: input.consolationFinal ?? false,
  grandFinalReset: input.grandFinalReset ?? false,
  roundRobinMode: input.roundRobinMode ?? 'simple',
  groupCount: input.groupCount ?? 2,
  qualifiersPerGroup: input.qualifiersPerGroup ?? 2,
});
