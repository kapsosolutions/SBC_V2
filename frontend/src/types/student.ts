export interface Student {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  mobile: string;
  college: string;
  course: string;
  year: string;
  cardNumber: string;
  status: "approved" | "pending" | "rejected";
}

export interface Offer {
  id: string;
  businessId: string;
  title: string;
  description: string;
  discount: string;
  image: string;
  category: string;
  status: "active" | "inactive";
  createdAt?: unknown;
}

export interface Redemption {
  id?: string;
  businessId: string;
  studentId: string;
  studentName: string;
  studentMobile: string;
  offerId: string;
  offerTitle: string;
  discount: string;
  redeemedAt?: unknown;
  status: "redeemed";
}

export interface RedemptionResult {
  success: boolean;
  message: string;
  usedCount: number;
}