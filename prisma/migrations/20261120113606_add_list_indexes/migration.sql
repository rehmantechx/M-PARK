-- DropIndex
DROP INDEX "StickerOrder_buyerPhone_idx";

-- DropIndex
DROP INDEX "StickerOrder_userId_idx";

-- CreateIndex
CREATE INDEX "ContactRequest_createdAt_idx" ON "ContactRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "ScanLog_createdAt_idx" ON "ScanLog"("createdAt");

-- CreateIndex
CREATE INDEX "StickerOrder_userId_createdAt_idx" ON "StickerOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StickerOrder_buyerPhone_createdAt_idx" ON "StickerOrder"("buyerPhone", "createdAt");

-- CreateIndex
CREATE INDEX "StickerOrder_orderStatus_idx" ON "StickerOrder"("orderStatus");

-- CreateIndex
CREATE INDEX "StickerOrder_createdAt_idx" ON "StickerOrder"("createdAt");

-- CreateIndex
CREATE INDEX "Subscription_createdAt_idx" ON "Subscription"("createdAt");

-- CreateIndex
CREATE INDEX "User_role_createdAt_idx" ON "User"("role", "createdAt");

-- CreateIndex
CREATE INDEX "Vehicle_createdAt_idx" ON "Vehicle"("createdAt");
