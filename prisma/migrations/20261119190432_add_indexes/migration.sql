-- CreateIndex
CREATE INDEX "ContactRequest_vehicleId_idx" ON "ContactRequest"("vehicleId");

-- CreateIndex
CREATE INDEX "ContactRequest_status_idx" ON "ContactRequest"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "OtpCode_phone_purpose_verified_idx" ON "OtpCode"("phone", "purpose", "verified");

-- CreateIndex
CREATE INDEX "QrCode_vehicleId_idx" ON "QrCode"("vehicleId");

-- CreateIndex
CREATE INDEX "QrCode_batch_idx" ON "QrCode"("batch");

-- CreateIndex
CREATE INDEX "QrCode_status_idx" ON "QrCode"("status");

-- CreateIndex
CREATE INDEX "ScanLog_vehicleId_idx" ON "ScanLog"("vehicleId");

-- CreateIndex
CREATE INDEX "StickerOrder_userId_idx" ON "StickerOrder"("userId");

-- CreateIndex
CREATE INDEX "StickerOrder_paymentStatus_idx" ON "StickerOrder"("paymentStatus");

-- CreateIndex
CREATE INDEX "StickerOrder_buyerPhone_idx" ON "StickerOrder"("buyerPhone");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_endDate_idx" ON "Subscription"("status", "endDate");

-- CreateIndex
CREATE INDEX "Vehicle_ownerId_idx" ON "Vehicle"("ownerId");
