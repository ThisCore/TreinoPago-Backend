import { PaymentStatus } from "@prisma/client";

export class CreateChargeDto {
clientId: string;
  dueDate: Date;
  amount: number;
  status: PaymentStatus;
  reminderSent?: boolean;
}
