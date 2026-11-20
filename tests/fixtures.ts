import fs from "node:fs";
import path from "node:path";

export interface QaFixtures {
  runSuffix: string;
  freeCodes: string[];
  lostCode: string;
  rateQr: string;
  ratePhone: string;
  verifyPhone: string;
  blockPhone: string;
  editPhone: string;
  editPlate: string;
  registerPhone: string;
  registerPlate: string;
  seededCustomerPhone: string;
  seededVehiclePlate: string;
  qaScannerPhone: string;
  foreignPlate: string;
  foreignPhone: string;
  foreignName: string;
}

export const fx: QaFixtures = JSON.parse(
  fs.readFileSync(path.join(".auth", "fixtures.json"), "utf8"),
) as QaFixtures;
