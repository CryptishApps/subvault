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

export const handleize = (name: string) => {
  const handle = name.toLowerCase().replace(/ /g, '-');
  // Replace any non-alphanumeric characters (except hyphens) with an empty string
  const cleanHandle = handle.replace(/[^a-z0-9-]/g, '');
  if (cleanHandle.length > 32) {
    return cleanHandle.slice(0, 32);
  }
  return cleanHandle;
}