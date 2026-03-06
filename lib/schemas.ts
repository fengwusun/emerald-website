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
  access_level: z.enum(["team", "public"]).default("team")
});

export const RawTargetRowSchema = z.object({
  emerald_id: z.string().min(1),
  name: z.string().min(1),
  ra: z.coerce.number(),
  dec: z.coerce.number(),
  z_spec: z.coerce.number().nonnegative(),
  status: z.string().min(1),
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
      ancillary_assets: z.array(AncillaryAssetSchema).parse(parsedAssets)
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
  email: z.string().email(),
  role: z.string().min(1),
  affiliation: z.string().min(1),
  profile_url: z.string().url().optional(),
  orcid: z
    .string()
    .regex(/^(\d{4}-){3}\d{3}[\dX]$/)
    .optional()
});

export type CoiMember = z.infer<typeof CoiMemberSchema>;
