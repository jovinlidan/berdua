import type { Couple, PartnerKey } from '../types'

export const PARTNER_COLORS: Record<PartnerKey, string> = {
  A: '#E8927C', // coral
  B: '#7C8A6F', // sage
}

export const partnerName = (couple: Pick<Couple, 'partnerAName' | 'partnerBName'>, key: PartnerKey) =>
  key === 'A' ? couple.partnerAName : couple.partnerBName

export const initialOf = (name?: string) => name?.trim()?.[0]?.toUpperCase() ?? '·'

export const otherPartner = (key: PartnerKey): PartnerKey => (key === 'A' ? 'B' : 'A')
