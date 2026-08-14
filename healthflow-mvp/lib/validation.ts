import { z } from 'zod';

/**
 * 건강 기록 입력값 검증.
 * 클라이언트에서도 검증하지만, 서버에서 다시 검증하는 이유:
 * 클라이언트 검증은 우회 가능(개발자도구, 직접 API 호출)하므로
 * 실제 데이터 무결성을 보장하는 건 항상 서버 쪽 검증이다.
 */
export const healthRecordSchema = z.object({
  sleepHours: z.number().min(0).max(24).optional(),
  sleepQuality: z.number().int().min(1).max(5).optional(),
  fatigue: z.number().int().min(1).max(5).optional(),
  stress: z.number().int().min(1).max(5).optional(),
  exerciseMinutes: z.number().int().min(0).max(1440).optional(),
  mood: z.string().max(20).optional(),
  memo: z.string().max(500).optional(), // 과도한 길이는 LLM 프롬프트 비용/오남용으로 이어질 수 있어 제한
  cycleStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cycleEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type HealthRecordInput = z.infer<typeof healthRecordSchema>;

export const birthInfoSchema = z.object({
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => new Date(v) <= new Date(), '미래 날짜는 입력할 수 없어요'),
});
