import { prisma } from "@/lib/db";

const SETTINGS_ID = "store";

/** Returns the singleton store settings, creating defaults on first call. */
export async function getSettings() {
  return prisma.storeSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export { SETTINGS_ID };
