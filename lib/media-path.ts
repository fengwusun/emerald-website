const DEFAULT_LOCAL_MEDIA_DIR = "/Users/sunfengwu/Downloads/emerald_msa_ptg-2026";
const DEFAULT_SERVER_MEDIA_DIR = "/data/emerald/media";

export function getMediaBaseDir(): string {
  return (
    process.env.EMERALD_LOCAL_MEDIA_DIR ||
    process.env.EMERALD_LOCAL_PDF_DIR ||
    (process.env.NODE_ENV === "production" ? DEFAULT_SERVER_MEDIA_DIR : DEFAULT_LOCAL_MEDIA_DIR)
  );
}

