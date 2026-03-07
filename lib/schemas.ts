import { z } from "zod";

export const AssetTypeSchema = z.enum(["image", "sed", "spectrum", "other"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AncillaryAssetSchema = z.object({
  asset_type: AssetTypeSchema,
  label: z.string().min(1),
  storage_key: z
    .string()
    .regex(/^[-a-zA-Z0-9_./]+$/, "storage_key contains invalid characters"),
  preview_url: z
    .string()
    .refine((value) => value.startsWith("/") || /^https?:\/\//.test(value), {
      message: "preview_url must be an absolute URL or an internal path"
    })
    .optional(),
  spectrum_profile: z
    .string()
    .regex(/^[-a-zA-Z0-9_]+$/)
    .optional(),
  access_level: z.enum(["team", "public"]).default("team")
});

export const ObservationModeSchema = z.object({
  instrument: z.string().min(1),
  status: z.string().min(1)
});

export const RawTargetRowSchema = z.object({
  emerald_id: z.string().min(1),
  name: z.string().min(1),
  ra: z.coerce.number(),
  dec: z.coerce.number(),
  z_spec: z.coerce.number().nonnegative(),
  status: z.string().min(1),
  instrument: z.string().default(""),
  priority: z.enum(["high", "medium", "low"]),
  jwst_program_id: z.string().min(1),
  notes: z.string().default(""),
  ancillary_assets: z.string().default("[]")
});

export const TargetRecordSchema = RawTargetRowSchema.transform((row, ctx) => {
  try {
    const parsedAssets = JSON.parse(row.ancillary_assets);
    return {
      ...row,
      ancillary_assets: z.array(AncillaryAssetSchema).parse(parsedAssets),
      instruments: [] as string[],
      observation_modes: [] as Array<z.infer<typeof ObservationModeSchema>>,
      emission_line_tags: [] as string[]
    };
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid ancillary_assets JSON for target ${row.emerald_id}`
    });
    return z.NEVER;
  }
});

export type TargetRecord = z.infer<typeof TargetRecordSchema>;

export const CoiMemberSchema = z.object({
  name: z.string().min(1),
  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .refine((value) => value === "" || z.string().email().safeParse(value).success, {
      message: "email must be empty or a valid email address"
    }),
  role: z.string().min(1),
  affiliation: z.string().min(1),
  profile_url: z.string().url().optional(),
  orcid: z
    .string()
    .regex(/^(\d{4}-){3}\d{3}[\dX]$/)
    .optional()
});

export type CoiMember = z.infer<typeof CoiMemberSchema>;

export const RedshiftSubmissionInputSchema = z.object({
  emerald_id: z.string().trim().min(1).optional(),
  source_name: z.string().trim().min(1),
  source_id: z.string().trim().min(1).optional(),
  z_best: z.number().finite().gt(-1).lt(20),
  selected_line_ids: z.array(z.string().trim().min(1)).default([]),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  reporter_name: z.string().trim().min(1).max(120),
  reporter_email: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value.length === 0 || z.string().email().safeParse(value).success, {
      message: "reporter_email must be empty or a valid email address"
    })
    .optional(),
  comment: z.string().trim().max(1200).optional(),
  spectrum_asset_key: z.string().trim().max(500).optional()
});

export type RedshiftSubmissionInput = z.infer<typeof RedshiftSubmissionInputSchema>;
