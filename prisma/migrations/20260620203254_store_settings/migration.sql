-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'store',
    "shopName" TEXT NOT NULL DEFAULT 'Comet Tail Crafts',
    "tagline" TEXT NOT NULL DEFAULT 'Handmade goods from across the galaxy',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "shippingFlatCents" INTEGER NOT NULL DEFAULT 700,
    "freeShippingThresholdCents" INTEGER,
    "updatedAt" DATETIME NOT NULL
);
