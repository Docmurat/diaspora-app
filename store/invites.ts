const validInvites = [
  'KARACHAI2024',
  'BALKAR2024',
  'DIASPORA01',
];

export function checkInvite(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return validInvites.includes(normalized);
}