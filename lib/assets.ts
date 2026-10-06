export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const QC_LABEL: Record<string, string> = {
  menunggu: "Menunggu QC",
  lolos: "Lolos",
  perlu_cek: "Perlu cek",
  gagal: "Gagal",
};

export const SIGNED_URL_TTL_SEC = 60 * 60;
