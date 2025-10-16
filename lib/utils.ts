import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import crypto from 'crypto';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generatePassword(address: string) {
  const passwordSecret = process.env.PASSWORD_SECRET!;
  const password = crypto
    .createHmac('sha256', passwordSecret)
    .update(address)
    .digest('hex');

    return password;
}

export const formatAddress = (address: string) => {
  return `${address.slice(0, 5)}...${address.slice(-5)}`;
}