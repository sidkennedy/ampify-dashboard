export type CallStatus = 'queued' | 'scheduled' | 'in_progress' | 'completed' | 'failed'
export type UserRole = 'staff' | 'admin' | 'superadmin'
export type VerificationType = 'diagnostic' | 'hearing_aid' | 'abr' | 'apd' | 'vestibular'

export interface Clinic {
  id: string
  name: string
  address: string | null
  npi: string | null
  tax_id: string | null
  status: 'active' | 'inactive'
  created_at: string
}

export interface Profile {
  id: string
  clinic_id: string | null
  role: UserRole
  full_name: string | null
  email: string | null
}

export interface Template {
  id: string
  clinic_id: string
  name: string
  codes_requested: string
  created_at: string
}

export interface Call {
  id: string
  vapi_call_id: string | null
  clinic_id: string
  patient_name: string
  dob: string
  member_id: string
  provider_npi: string | null
  clinic_tax_id: string | null
  clinic_name: string | null
  clinic_address: string | null
  insurance_phone: string
  codes_requested: string
  phone_number_id: string | null
  // Verification template fields
  verification_type: VerificationType | null
  date_of_service: string | null
  plan_type: string | null
  state: string | null
  diagnosis_code: string | null
  status: CallStatus
  scheduled_for: string | null
  structured_output_eligibility: EligibilityOutput | null
  structured_output_codes: CodesOutput | null
  transcript: string | null
  recording_url: string | null
  duration_seconds: number | null
  ended_reason: string | null
  cost: number | null
  created_at: string
  updated_at: string
  started_at: string | null
  ended_at: string | null
}

export interface EligibilityOutput {
  member: {
    patientName: string
    dob: string
    memberId: string
    groupNumber?: string | null
    coverageLevel?: string | null
    eligibilityStatus?: string | null
    eligibilityEffectiveDate?: string | null
    eligibilityEndDate?: string | null
  }
  plan?: {
    planName?: string | null
    planType?: string | null
    payerName?: string | null
    networkName?: string | null
    pcpRequired?: boolean | null
    referralRequired?: boolean | null
    priorAuthRequired?: boolean | null
    isInNetworkVerified?: boolean | null
    medicalNecessityRequired?: boolean | null
    fundingType?: string | null
  }
  benefits?: {
    benefitPeriod?: string | null
    deductible?: {
      individualTotal?: number | null
      individualRemaining?: number | null
      familyTotal?: number | null
      familyRemaining?: number | null
      appliesToAudiology?: boolean | null
    }
    outOfPocketMax?: {
      individualTotal?: number | null
      individualRemaining?: number | null
      familyTotal?: number | null
      familyRemaining?: number | null
    }
    coinsurance?: {
      inNetworkPercent?: number | null
      outOfNetworkPercent?: number | null
    }
    copays?: {
      hearingExam?: number | null
      audiologyVisit?: number | null
      specialistVisit?: number | null
    }
    audiologyExam?: {
      covered?: boolean | null
      visitLimit?: string | null
      frequencyLimit?: string | null
      coverageDetails?: string | null
      codesMentioned?: string[] | null
    }
    hearingAidBenefit?: {
      covered?: boolean | null
      frequency?: string | null
      allowanceAmount?: number | null
      allowanceType?: string | null
      requiresPriorAuth?: boolean | null
      requiresReferral?: boolean | null
      vendorRestriction?: string | null
      deductibleApplies?: boolean | null
      coinsurancePercent?: number | null
      copayAmount?: number | null
      ageRestrictions?: string | null
      coverageNotes?: string | null
      codesMentioned?: string[] | null
    }
    earMoldsAccessories?: {
      covered?: boolean | null
      details?: string | null
    }
    outOfNetwork?: {
      coverageDifferent?: boolean | null
      details?: string | null
    }
  }
  provider?: {
    providerNPI?: string | null
    clinicTaxId?: string | null
    providerName?: string | null
    providerInNetworkStatus?: string | null
  }
  callReference?: {
    repName?: string | null
    department?: string | null
    callReferenceNumber?: string | null
    repReferenceId?: string | null
    callTimestamp?: string | null
  }
  confidence?: 'high' | 'medium' | 'low' | null
  notes?: string | null
}

export interface CodesOutput {
  member: {
    patientName: string
    dob: string
    memberId: string
    groupNumber?: string | null
  }
  codesRequested?: string | null
  requestedCodes: Array<{
    code: string
    covered?: boolean | null
    priorAuthRequired?: boolean | null
    referralRequired?: boolean | null
    deductibleApplies?: boolean | null
    coinsurance?: string | null
    copay?: string | null
    frequencyLimits?: string | null
    dollarCaps?: string | null
    networkRestrictions?: string | null
    notes?: string | null
  }>
  provider?: {
    providerNPI?: string | null
    clinicTaxId?: string | null
    providerInNetworkStatus?: string | null
  }
  callReference?: {
    repName?: string | null
    department?: string | null
    callReferenceNumber?: string | null
    repReferenceId?: string | null
  }
  confidence?: 'high' | 'medium' | 'low' | null
  notes?: string | null
}
